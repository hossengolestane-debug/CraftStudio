import { z } from 'zod'
import { AppError } from './errors'
import type { CompatibilityEntry, PlatformId } from './types'
import { PLATFORM_IDS } from './types'

export const EVIDENCE_SCHEMA_VERSION = 1
export const EVIDENCE_FILENAME = 'craftstudio.runtime-evidence.json'

export const VERIFIED_WHAT = [
  'fabric_run_client',
  'neoforge_run_client',
  'forge_run_client',
  'paper_user_server',
  'spigot_user_server'
] as const
export type VerifiedWhat = (typeof VERIFIED_WHAT)[number]

export const runtimeEvidenceRecordSchema = z.object({
  id: z.string().min(8).max(80),
  timestamp: z.string().min(10).max(40),
  platform: z.enum(PLATFORM_IDS),
  minecraftVersion: z.string().min(1).max(16),
  projectId: z.string().min(1).max(80),
  verifiedWhat: z.enum(VERIFIED_WHAT),
  notes: z.string().trim().min(1).max(800),
  eulaAccepted: z.literal(true),
  compileOnly: z.boolean(),
  runtimeExitCode: z.number().int().nullable().optional(),
  userAttestedLaunch: z.boolean().optional()
})

export type RuntimeEvidenceRecord = z.infer<typeof runtimeEvidenceRecordSchema>

export const runtimeEvidenceFileSchema = z.object({
  schemaVersion: z.literal(EVIDENCE_SCHEMA_VERSION),
  records: z.array(runtimeEvidenceRecordSchema).max(200)
})

export type RuntimeEvidenceFile = z.infer<typeof runtimeEvidenceFileSchema>

export interface EvidenceDraft {
  platform: PlatformId
  minecraftVersion: string
  projectId: string
  verifiedWhat: VerifiedWhat
  notes: string
  eulaAccepted: boolean
  compileOnly?: boolean
  runtimeExitCode?: number | null
  userAttestedLaunch?: boolean
}

export interface LastRuntimeContext {
  task: 'build' | 'runClient'
  exitCode: number | null
  compileOnly: boolean
  cancelled: boolean
  timedOut: boolean
}

export function parseEvidenceFile(input: unknown): RuntimeEvidenceFile {
  const parsed = runtimeEvidenceFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError({
      code: 'EVIDENCE_REQUIRED',
      message: 'Runtime evidence file is not valid.',
      action: 'Delete craftstudio.runtime-evidence.json or record a new verified runtime.',
      details: parsed.error.issues.map((issue) => issue.message).join('; ')
    })
  }
  return parsed.data
}

export function canMarkTested(record: RuntimeEvidenceRecord): boolean {
  if (record.compileOnly) {
    return false
  }
  if (!record.eulaAccepted) {
    return false
  }
  if (
    record.verifiedWhat === 'fabric_run_client' ||
    record.verifiedWhat === 'neoforge_run_client' ||
    record.verifiedWhat === 'forge_run_client'
  ) {
    return record.runtimeExitCode === 0
  }
  if (record.verifiedWhat === 'paper_user_server' || record.verifiedWhat === 'spigot_user_server') {
    return record.userAttestedLaunch === true && record.notes.trim().length > 0
  }
  return false
}

export function assertCanRecordEvidence(draft: EvidenceDraft, lastRuntime?: LastRuntimeContext): void {
  if (draft.compileOnly) {
    throw new AppError({
      code: 'EVIDENCE_REQUIRED',
      message: 'A compile-only Gradle build cannot mark a compatibility row Tested.',
      action: 'Run a verified Fabric/NeoForge/Forge client or attest a Paper/Spigot server you launched yourself.'
    })
  }
  if (!draft.eulaAccepted) {
    throw new AppError({
      code: 'TERMS_REQUIRED',
      message: 'Runtime evidence requires an explicit Minecraft EULA acceptance.',
      action: 'Accept the EULA on the Test tab. CraftStudio never silent-accepts.'
    })
  }
  if (!draft.notes.trim()) {
    throw new AppError({
      code: 'EVIDENCE_REQUIRED',
      message: 'Runtime evidence needs a short note describing what you verified.',
      action: 'Write what ran (client world loaded, plugin command worked, etc.).'
    })
  }

  if (
    draft.verifiedWhat === 'fabric_run_client' ||
    draft.verifiedWhat === 'neoforge_run_client' ||
    draft.verifiedWhat === 'forge_run_client'
  ) {
    const expectedPlatform =
      draft.verifiedWhat === 'fabric_run_client'
        ? 'fabric'
        : draft.verifiedWhat === 'forge_run_client'
          ? 'forge'
          : 'neoforge'
    if (draft.platform !== expectedPlatform) {
      throw new AppError({
        code: 'EVIDENCE_REQUIRED',
        message: `${draft.verifiedWhat} evidence is only valid for ${expectedPlatform}.`,
        action: 'Record the matching platform. NeoForge success is not Forge compatibility, and the reverse is also true.'
      })
    }
    if (!lastRuntime || lastRuntime.task !== 'runClient') {
      throw new AppError({
        code: 'EVIDENCE_REQUIRED',
        message: 'No verified runClient result is on file for this project.',
        action: 'Accept the EULA, run Gradle runClient, and wait for exit 0 before recording Tested.'
      })
    }
    if (lastRuntime.compileOnly || lastRuntime.cancelled || lastRuntime.timedOut || lastRuntime.exitCode !== 0) {
      throw new AppError({
        code: 'EVIDENCE_REQUIRED',
        message: 'runClient did not finish with exit 0. This is not treated as Tested.',
        action: 'Fix the client run, or leave the row Experimental.'
      })
    }
    return
  }

  if (draft.verifiedWhat === 'paper_user_server' || draft.verifiedWhat === 'spigot_user_server') {
    const expected = draft.verifiedWhat === 'paper_user_server' ? 'paper' : 'spigot'
    if (draft.platform !== expected) {
      throw new AppError({
        code: 'EVIDENCE_REQUIRED',
        message: `${expected === 'paper' ? 'Paper' : 'Spigot'} server evidence is only valid for ${expected} projects.`,
        action: 'Do not treat Paper success as Spigot compatibility.'
      })
    }
    if (draft.userAttestedLaunch !== true) {
      throw new AppError({
        code: 'EVIDENCE_REQUIRED',
        message: `${expected} Tested status requires you to attest that you launched your own ${expected} server.`,
        action: `Download ${expected} yourself, load the plugin, then check the attestation box. CraftStudio will not launch a server.`
      })
    }
    return
  }

  throw new AppError({
    code: 'EVIDENCE_REQUIRED',
    message: 'Unknown verification kind.',
    action: 'Use fabric_run_client, neoforge_run_client, forge_run_client, paper_user_server, or spigot_user_server.'
  })
}

export function overlayCompatibility(
  entries: CompatibilityEntry[],
  evidence: RuntimeEvidenceRecord[]
): CompatibilityEntry[] {
  return entries.map((entry) => {
    const match = evidence.find(
      (record) =>
        record.platform === entry.platform &&
        record.minecraftVersion === entry.minecraftVersion &&
        canMarkTested(record)
    )
    if (!match) {
      return entry
    }
    return {
      ...entry,
      status: 'tested',
      notes: `Tested ${match.verifiedWhat} at ${match.timestamp}. ${match.notes}`
    }
  })
}

export function formatEvidenceSummary(
  records: RuntimeEvidenceRecord[],
  context?: { appVersion?: string; generatedAt?: string }
): string {
  const generatedAt = context?.generatedAt ?? new Date().toISOString()
  const appVersion = context?.appVersion ?? 'unknown'
  const lines = [
    '# CraftStudio runtime evidence summary',
    '',
    `Generated: ${generatedAt}`,
    `App version: ${appVersion}`,
    '',
    'A compile-only Gradle build never marks Tested. This file lists recorded runtime evidence only.',
    'Packages remain unsigned unless a real certificate exists.',
    '',
    `Records: ${records.length}`,
    ''
  ]
  if (records.length === 0) {
    lines.push('No runtime evidence has been recorded. Compatibility rows stay Experimental.', '')
    return lines.join('\n')
  }
  for (const record of records) {
    const tested = canMarkTested(record) ? 'can mark Tested' : 'insufficient for Tested'
    lines.push(`## ${record.platform} ${record.minecraftVersion} (${record.verifiedWhat})`)
    lines.push('')
    lines.push(`- id: ${record.id}`)
    lines.push(`- timestamp: ${record.timestamp}`)
    lines.push(`- project: ${record.projectId}`)
    lines.push(`- compileOnly: ${record.compileOnly}`)
    lines.push(`- eulaAccepted: ${record.eulaAccepted}`)
    lines.push(`- runtimeExitCode: ${record.runtimeExitCode ?? 'n/a'}`)
    lines.push(`- userAttestedLaunch: ${record.userAttestedLaunch ?? 'n/a'}`)
    lines.push(`- status: ${tested}`)
    lines.push(`- notes: ${record.notes}`)
    lines.push('')
  }
  return lines.join('\n')
}

export function hasValidEvidence(
  evidence: RuntimeEvidenceRecord[],
  platform: PlatformId,
  minecraftVersion: string
): boolean {
  return evidence.some(
    (record) =>
      record.platform === platform && record.minecraftVersion === minecraftVersion && canMarkTested(record)
  )
}
