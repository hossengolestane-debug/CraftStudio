import { useEffect, useState } from 'react'
import type { AppSettings, OllamaStatus } from '../../../shared/types'
import type { JavaStatusDto } from '../../../shared/ipc'
import { Badge, Button, Card } from './ui'

const STORAGE_KEY = 'craftstudio.firstRunChecklist.dismissed'

const api = window.craftstudio

export function FirstRunChecklist({
  settings
}: {
  settings: AppSettings | null
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [java, setJava] = useState<JavaStatusDto | null>(null)
  const [ollama, setOllama] = useState<OllamaStatus | null>(null)

  useEffect(() => {
    if (dismissed) {
      return
    }
    void api.checkJava().then(setJava).catch(() => undefined)
    void api.checkOllama().then(setOllama).catch(() => undefined)
  }, [dismissed])

  if (dismissed) {
    return null
  }

  const items = [
    {
      id: 'jdk',
      label: 'JDK 21 on PATH',
      ok: Boolean(java?.meets),
      detail: java?.message ?? 'Checking Java…'
    },
    {
      id: 'ollama',
      label: 'Ollama (optional)',
      ok: Boolean(ollama?.connected),
      detail: ollama?.message ?? 'Checking Ollama… Templates work without it.'
    },
    {
      id: 'projects',
      label: 'Projects folder',
      ok: Boolean(settings?.projectsPath),
      detail: settings?.projectsPath ?? 'Set a projects folder in Settings.'
    },
    {
      id: 'eula',
      label: 'Minecraft EULA awareness',
      ok: Boolean(settings?.minecraftEulaAccepted),
      detail: settings?.minecraftEulaAccepted
        ? 'EULA accepted in Settings / Test. CraftStudio never silent-accepts.'
        : 'You must accept the Minecraft EULA yourself before runClient. CraftStudio never silent-accepts.'
    }
  ]

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">First-run checklist</h2>
          <p className="mt-1 text-sm text-muted">
            Local toolchain only. Dismissing hides this card on this machine; it does not skip the EULA gate.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, '1')
            } catch {
              // ignore
            }
            setDismissed(true)
          }}
        >
          Dismiss
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <Badge tone={item.ok ? 'ok' : 'warn'}>{item.ok ? 'Ready' : 'Check'}</Badge>
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
