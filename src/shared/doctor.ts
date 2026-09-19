import { diagnoseBuildLogs } from './buildDiagnostics'

export interface DoctorFinding {
  id: string
  ok: boolean
  title: string
  hint: string
}

export interface DoctorInput {
  javaAvailable: boolean
  javaVersion: number | null
  requiredJava: number
  hasGradlew: boolean
  hasWrapperJar: boolean
  hasWrapperProps: boolean
  lastBuildLogs?: string
}

export function flattenFilePaths(nodes: { relativePath: string; type: string; children?: unknown[] }[]): string[] {
  const paths: string[] = []
  const walk = (list: { relativePath: string; type: string; children?: unknown[] }[]): void => {
    for (const node of list) {
      paths.push(node.relativePath.replace(/\\/g, '/'))
      if (node.children && Array.isArray(node.children)) {
        walk(node.children as { relativePath: string; type: string; children?: unknown[] }[])
      }
    }
  }
  walk(nodes)
  return paths
}

export function assessDoctor(input: DoctorInput): DoctorFinding[] {
  const findings: DoctorFinding[] = []
  if (!input.javaAvailable) {
    findings.push({
      id: 'jdk-missing',
      ok: false,
      title: 'JDK is missing',
      hint: `Install JDK ${input.requiredJava} and put \`java\` on PATH (or set JAVA_HOME). CraftStudio will not download a JDK.`
    })
  } else if (input.javaVersion !== null && input.javaVersion < input.requiredJava) {
    findings.push({
      id: 'jdk-major',
      ok: false,
      title: `JDK ${input.javaVersion} is below the required major ${input.requiredJava}`,
      hint: `Use JDK ${input.requiredJava} for 1.21.x Gradle pins, then re-run the allowlisted build.`
    })
  } else {
    findings.push({
      id: 'jdk-ok',
      ok: true,
      title: `JDK ${input.javaVersion ?? input.requiredJava} meets the pin`,
      hint: 'Toolchain looks ready for compile. This is not a Tested runtime row.'
    })
  }

  if (!input.hasGradlew || !input.hasWrapperProps) {
    findings.push({
      id: 'wrapper-missing',
      ok: false,
      title: 'Gradle wrapper is missing',
      hint: 'Open Design, apply a validated spec, then build. CraftStudio only runs the vendored wrapper — never a system Gradle.'
    })
  } else if (!input.hasWrapperJar) {
    findings.push({
      id: 'wrapper-jar',
      ok: false,
      title: 'gradle-wrapper.jar is missing',
      hint: 'Re-apply the spec so the vendored wrapper jar is written. Do not copy a random Gradle install into the project.'
    })
  } else {
    findings.push({
      id: 'wrapper-ok',
      ok: true,
      title: 'Vendored Gradle wrapper is present',
      hint: 'gradlew + wrapper properties + wrapper jar were found in this project folder.'
    })
  }

  if (input.lastBuildLogs) {
    const offline = diagnoseBuildLogs(input.lastBuildLogs, true).filter((item) => item.id === 'offline-deps')
    if (offline.length > 0) {
      findings.push({
        id: 'offline-cache',
        ok: false,
        title: 'Loader artifacts or Gradle cache failed',
        hint: offline[0]?.action ??
          'Connect to the network or populate ~/.gradle so the pinned loader can download. Offline builds need a warm cache.'
      })
    }
  }

  return findings
}
