export type BuildRepairId =
  | 'featureflags-vanilla-features'
  | 'jetbrains-notnull'
  | 'switch-yield-entity'
  | 'forge-mod-context'

export interface BuildDiagnostic {
  id: string
  title: string
  action: string
  details: string
  repairId?: BuildRepairId
}

const RULES: {
  id: string
  pattern: RegExp
  title: string
  action: string
  repairId?: BuildRepairId
}[] = [
  {
    id: 'jdk-missing',
    pattern: /JAVA_HOME|Unable to locate a Java Runtime|java: command not found|Could not find java/i,
    title: 'JDK is missing or not on PATH',
    action: 'Install JDK 21 and ensure `java` is on PATH (or set JAVA_HOME). CraftStudio will not download a JDK.'
  },
  {
    id: 'jdk-too-old',
    pattern: /invalid source release|release version \d+ not supported|Unsupported class file major version/i,
    title: 'Java toolchain is too old for this pin',
    action: 'Use JDK 21 for 1.21.x Gradle projects. Then re-run the allowlisted build.'
  },
  {
    id: 'offline-deps',
    pattern:
      /Could not resolve|Could not GET|Unknown host|Connection refused|Network is unreachable|Received status code 4\d\d|Received status code 5\d\d|Failed to get resource/i,
    title: 'Loader artifacts or Gradle caches are missing / unreachable',
    action:
      'Connect to the network (or populate the Gradle cache) so Forge/NeoForge/Fabric/Paper/Spigot pins can download. Offline builds need a warm cache.'
  },
  {
    id: 'wrapper-missing',
    pattern: /Could not start Gradle|ENOENT.*gradlew|spawn .*gradlew/i,
    title: 'Gradle wrapper is missing or failed to start',
    action: 'Open Design, apply a validated spec, then build. CraftStudio only runs the vendored wrapper — never a system Gradle.'
  },
  {
    id: 'featureflags-vanilla',
    pattern: /incompatible types:.*FeatureFlag|FeatureFlag cannot be converted to FeatureSet|FeatureFlags\.VANILLA\)/i,
    title: 'Fabric ScreenHandlerType needs FeatureFlags.VANILLA_FEATURES',
    action: 'Use the known template repair, or re-apply the spec. Do not hand-edit Gradle.',
    repairId: 'featureflags-vanilla-features'
  },
  {
    id: 'jetbrains-notnull',
    pattern: /package org\.jetbrains\.annotations does not exist|cannot find symbol[\s\S]{0,80}NotNull/i,
    title: 'JetBrains @NotNull is not on the plugin classpath',
    action: 'Spigot/Paper templates must not import org.jetbrains.annotations. Use the known template repair or re-apply.',
    repairId: 'jetbrains-notnull'
  },
  {
    id: 'switch-return',
    pattern: /error: not a statement|illegal start of expression|attempting to use a return in a switch expression/i,
    title: 'Illegal return inside a switch expression',
    action: 'Plugin spawn helpers must `yield entity` inside switch expressions. Use the known template repair or re-apply.',
    repairId: 'switch-yield-entity'
  },
  {
    id: 'deprecated-fml-get',
    pattern: /FMLJavaModLoadingContext\.get\(\)/,
    title: 'Forge mod bus should use the constructor-injected context',
    action: 'Re-apply the Forge template, or use the known repair that injects FMLJavaModLoadingContext.',
    repairId: 'forge-mod-context'
  },
  {
    id: 'compile-java',
    pattern: /Execution failed for task ':compileJava'|error: cannot find symbol|error: package .* does not exist/,
    title: 'Java compile failed',
    action:
      'Expand the technical log. If this is a known template mismatch, try the bounded repair. Otherwise re-apply the spec — do not run model-authored shell.'
  }
]

export function diagnoseBuildLogs(logs: string, started: boolean): BuildDiagnostic[] {
  const text = logs || ''
  const found: BuildDiagnostic[] = []
  const seen = new Set<string>()
  for (const rule of RULES) {
    if (!rule.pattern.test(text)) {
      continue
    }
    if (seen.has(rule.id)) {
      continue
    }
    seen.add(rule.id)
    const match = text.match(rule.pattern)
    found.push({
      id: rule.id,
      title: rule.title,
      action: rule.action,
      details: match?.[0] ? `Matched: ${match[0].slice(0, 240)}` : text.slice(0, 400),
      repairId: rule.repairId
    })
  }
  if (!started && !seen.has('wrapper-missing') && !seen.has('jdk-missing')) {
    found.unshift({
      id: 'gradle-not-started',
      title: 'Gradle did not start',
      action:
        'Apply a spec so the project has a vendored gradlew, then confirm JDK 21 is installed. This is not treated as success.',
      details: text.slice(0, 400) || 'No process output.'
    })
  }
  return found
}
