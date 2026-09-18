import { useEffect, useState } from 'react'
import { assessDoctor, flattenFilePaths, type DoctorFinding } from '../../../shared/doctor'
import type { JavaStatusDto } from '../../../shared/ipc'
import { Badge, Card } from './ui'

const api = window.craftstudio

export function EnvironmentDoctor({
  projectId,
  lastBuildLogs,
  requiredJava = 21
}: {
  projectId?: string
  lastBuildLogs?: string
  requiredJava?: number
}) {
  const [java, setJava] = useState<JavaStatusDto | null>(null)
  const [findings, setFindings] = useState<DoctorFinding[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const nextJava = await api.checkJava(projectId).catch(() => null)
      let hasGradlew = false
      let hasWrapperJar = false
      let hasWrapperProps = false
      if (projectId) {
        const tree = await api.listProjectFiles(projectId).catch(() => [])
        const paths = flattenFilePaths(tree)
        hasGradlew = paths.includes('gradlew') || paths.includes('gradlew.bat')
        hasWrapperJar = paths.includes('gradle/wrapper/gradle-wrapper.jar')
        hasWrapperProps = paths.includes('gradle/wrapper/gradle-wrapper.properties')
      }
      if (cancelled) {
        return
      }
      setJava(nextJava)
      setFindings(
        assessDoctor({
          javaAvailable: Boolean(nextJava?.available),
          javaVersion: nextJava?.version ?? null,
          requiredJava: nextJava?.required ?? requiredJava,
          hasGradlew: projectId ? hasGradlew : true,
          hasWrapperJar: projectId ? hasWrapperJar : true,
          hasWrapperProps: projectId ? hasWrapperProps : true,
          lastBuildLogs
        })
      )
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, lastBuildLogs, requiredJava])

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Dependency / cache doctor</h2>
        <p className="mt-1 text-sm text-muted">
          Checks JDK major, the vendored Gradle wrapper, and last-build cache errors. This never marks Tested.
        </p>
      </div>
      {java ? <p className="text-sm">{java.message}</p> : <p className="text-sm">Checking Java…</p>}
      <ul className="space-y-2">
        {findings.map((finding) => (
          <li key={finding.id} className="border border-line p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={finding.ok ? 'ok' : 'danger'}>{finding.ok ? 'OK' : 'Fix'}</Badge>
              <span className="text-sm font-medium">{finding.title}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{finding.hint}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
