import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../shared/errors'
import {
  assertCanRecordEvidence,
  canMarkTested,
  EVIDENCE_FILENAME,
  EVIDENCE_SCHEMA_VERSION,
  parseEvidenceFile,
  type EvidenceDraft,
  type LastRuntimeContext,
  type RuntimeEvidenceRecord
} from '../../shared/evidence'

export class EvidenceService {
  constructor(private readonly userDataPath: string) {}

  filePath(): string {
    return path.join(this.userDataPath, EVIDENCE_FILENAME)
  }

  async list(): Promise<RuntimeEvidenceRecord[]> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(), 'utf8')) as unknown
      return parseEvidenceFile(raw).records.filter(canMarkTested)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      if (error instanceof AppError) {
        throw error
      }
      return []
    }
  }

  async record(draft: EvidenceDraft, lastRuntime?: LastRuntimeContext): Promise<RuntimeEvidenceRecord> {
    assertCanRecordEvidence(draft, lastRuntime)
    const record: RuntimeEvidenceRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      platform: draft.platform,
      minecraftVersion: draft.minecraftVersion,
      projectId: draft.projectId,
      verifiedWhat: draft.verifiedWhat,
      notes: draft.notes.trim(),
      eulaAccepted: true,
      compileOnly: false,
      runtimeExitCode: draft.verifiedWhat === 'paper_user_server' ? draft.runtimeExitCode ?? null : 0,
      userAttestedLaunch: draft.verifiedWhat === 'paper_user_server' ? true : draft.userAttestedLaunch
    }
    if (!canMarkTested(record)) {
      throw new AppError({
        code: 'EVIDENCE_REQUIRED',
        message: 'The evidence record did not pass Tested gating.',
        action: 'Compile-only builds cannot mark Tested. Complete a verified runtime path.'
      })
    }
    const records = await this.list()
    const next = [
      ...records.filter(
        (item) => !(item.platform === record.platform && item.minecraftVersion === record.minecraftVersion)
      ),
      record
    ]
    await writeFile(
      this.filePath(),
      `${JSON.stringify({ schemaVersion: EVIDENCE_SCHEMA_VERSION, records: next }, null, 2)}\n`,
      'utf8'
    )
    return record
  }
}
