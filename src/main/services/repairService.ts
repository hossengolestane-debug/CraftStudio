import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { diagnoseBuildLogs, type BuildRepairId } from '../../shared/buildDiagnostics'
import { isTrustedOutputPath } from '../codegen/allowlist'
import { resolveProjectFile } from './pathSafety'

export interface RepairResult {
  attempted: boolean
  applied: string[]
  remaining: string[]
  filesChanged: string[]
  message: string
}

const REPAIRS: Record<BuildRepairId, { label: string; apply: (source: string) => string }> = {
  'featureflags-vanilla-features': {
    label: 'FeatureFlags.VANILLA → VANILLA_FEATURES',
    apply: (source) => source.replace(/FeatureFlags\.VANILLA(?!_FEATURES)/g, 'FeatureFlags.VANILLA_FEATURES')
  },
  'jetbrains-notnull': {
    label: 'Remove JetBrains @NotNull',
    apply: (source) =>
      source.replace(/import org\.jetbrains\.annotations\.NotNull;\n/g, '').replace(/@NotNull\s+/g, '')
  },
  'switch-yield-entity': {
    label: 'return entity → yield entity in switch arms',
    apply: (source) => source.replace(/return entity;/g, 'yield entity;')
  },
  'forge-mod-context': {
    label: 'Inject FMLJavaModLoadingContext instead of get()',
    apply: (source) =>
      source.replace(
        /public (\w+)\(\) \{\n(\s*)IEventBus bus = FMLJavaModLoadingContext\.get\(\)\.getModEventBus\(\);/g,
        'public $1(FMLJavaModLoadingContext context) {\n$2IEventBus bus = context.getModEventBus();'
      )
  }
}

async function listJavaRelativePaths(javaRoot: string): Promise<string[]> {
  const collected: string[] = []
  const walk = async (dir: string, prefix: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const next = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), next)
      } else if (entry.isFile() && entry.name.endsWith('.java')) {
        collected.push(`src/main/java/${next}`)
      }
    }
  }
  await walk(javaRoot, '')
  return collected
}

export async function applyKnownTemplateRepairs(
  projectsRoot: string,
  projectDirName: string,
  logs: string,
  started: boolean
): Promise<RepairResult> {
  const diagnostics = diagnoseBuildLogs(logs, started)
  const repairIds = [...new Set(diagnostics.map((item) => item.repairId).filter(Boolean))] as BuildRepairId[]
  if (repairIds.length === 0) {
    return {
      attempted: false,
      applied: [],
      remaining: diagnostics.map((item) => item.title),
      filesChanged: [],
      message: 'No known template repair matched this log. Re-apply the spec or fix the remaining problems below.'
    }
  }

  const javaRoot = resolveProjectFile(projectsRoot, projectDirName, 'src/main/java')
  const relatives = await listJavaRelativePaths(javaRoot)
  const filesChanged: string[] = []
  const applied: string[] = []

  for (const repairId of repairIds) {
    const repair = REPAIRS[repairId]
    let used = false
    for (const relativePath of relatives) {
      if (!isTrustedOutputPath(relativePath) || !relativePath.endsWith('.java')) {
        continue
      }
      const fullPath = resolveProjectFile(projectsRoot, projectDirName, relativePath)
      const before = await readFile(fullPath, 'utf8')
      const after = repair.apply(before)
      if (after !== before) {
        await writeFile(fullPath, after, 'utf8')
        filesChanged.push(relativePath)
        used = true
      }
    }
    if (used) {
      applied.push(repair.label)
    }
  }

  const remaining = diagnostics
    .filter((item) => !item.repairId || !applied.includes(REPAIRS[item.repairId].label))
    .map((item) => item.title)

  return {
    attempted: applied.length > 0,
    applied,
    remaining,
    filesChanged: [...new Set(filesChanged)],
    message:
      applied.length > 0
        ? `Applied ${applied.length} known template repair(s) on allowlisted Java only. Re-run Gradle. Remaining: ${remaining.join('; ') || 'none listed'}.`
        : 'Known repairs were identified but no allowlisted Java file matched. Re-apply the spec. CraftStudio will not mutate build.gradle.'
  }
}
