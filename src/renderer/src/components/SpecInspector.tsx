import { useId, useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'
import {
  formatSpecJson,
  generatorSupportNote,
  LEGENDARY_MACE_GENERATOR_SUPPORT,
  specsMatch
} from '../../../shared/specInspector'
import type { ProjectSpec } from '../../../shared/spec'
import { asAppError } from '../lib/errors'
import { Button, Card } from './ui'

const api = window.craftstudio

export function SpecInspector({
  projectId,
  draftSpec,
  appliedSpec,
  appliedAt,
  onError
}: {
  projectId: string
  draftSpec: ProjectSpec
  appliedSpec: ProjectSpec | null
  appliedAt: string | null
  onError: (error: AppErrorPayload) => void
}) {
  const headingId = useId()
  const jsonId = useId()
  const appliedJsonId = useId()
  const [copied, setCopied] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const draftJson = formatSpecJson(draftSpec)
  const matchesApplied = specsMatch(draftSpec, appliedSpec)
  const supportNote = generatorSupportNote(draftSpec.unsupportedRequests.length)

  return (
    <Card className="space-y-4" id="specification-inspector">
      <div>
        <h2 id={headingId} className="text-lg font-semibold">
          Specification Inspector
        </h2>
        <p className="mt-1 text-sm text-muted">
          This is the complete in-memory draft Apply will use. It is not the truncated Live Activity AI preview. You do
          not need to generate again to inspect it.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border border-line bg-white p-3" aria-labelledby={`${headingId}-draft`}>
          <h3 id={`${headingId}-draft`} className="font-medium">
            Current draft
          </h3>
          <p className="mt-1 text-sm">What Apply will write. Source: {draftSpec.source}.</p>
          <p className="mt-1 text-sm text-muted">
            {matchesApplied
              ? 'Matches the last applied specification on disk.'
              : appliedSpec
                ? 'Has changes that are not applied yet.'
                : 'Not applied yet.'}
          </p>
        </div>
        <div className="border border-line bg-white p-3" aria-labelledby={`${headingId}-applied`}>
          <h3 id={`${headingId}-applied`} className="font-medium">
            Last applied
          </h3>
          <p className="mt-1 text-sm">
            {appliedSpec
              ? `On disk as craftstudio.spec.json${appliedAt ? ` · ${appliedAt}` : ''}.`
              : 'Not applied yet. Apply writes craftstudio.spec.json and generator files.'}
          </p>
        </div>
      </div>

      <div className="border border-line bg-white p-3" aria-labelledby={`${headingId}-gaps`}>
        <h3 id={`${headingId}-gaps`} className="font-medium">
          Unsupported requests
        </h3>
        {draftSpec.unsupportedRequests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None recorded on this draft.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {draftSpec.unsupportedRequests.map((item) => (
              <li key={`${item.feature}-${item.reason}`}>
                <span className="font-medium">{item.feature}</span>
                <span className="text-muted"> — {item.reason}</span>
              </li>
            ))}
          </ul>
        )}
        {supportNote ? <p className="mt-3 text-sm">{supportNote}</p> : null}
        {draftSpec.unsupportedRequests.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium underline-offset-2 hover:underline">
              Generator support (Legendary Mace-style features)
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {LEGENDARY_MACE_GENERATOR_SUPPORT.map((row) => (
                <li key={row.feature}>
                  <span className="font-medium">{row.feature}</span>
                  <span className="text-muted"> — {row.status}. {row.note}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(draftJson)
              .then(() => {
                setCopied(true)
                setExportNote(null)
              })
              .catch((err) => onError(asAppError(err)))
          }}
        >
          {copied ? 'Copied full JSON' : 'Copy full JSON'}
        </Button>
        <Button
          type="button"
          disabled={exporting}
          onClick={() => {
            setExporting(true)
            setCopied(false)
            void api
              .exportSpecificationJson(projectId, draftSpec)
              .then((result) => {
                setExportNote(`Wrote ${result.relativePath} (${result.bytes} bytes) inside this project folder.`)
              })
              .catch((err) => onError(asAppError(err)))
              .finally(() => setExporting(false))
          }}
        >
          {exporting ? 'Exporting…' : 'Export specification.json'}
        </Button>
      </div>
      {exportNote ? (
        <p role="status" className="text-sm">
          {exportNote}
        </p>
      ) : null}

      <details>
        <summary className="cursor-pointer font-medium underline-offset-2 hover:underline">
          Show complete draft JSON
        </summary>
        <pre
          id={jsonId}
          tabIndex={0}
          aria-label="Complete current draft specification JSON"
          className="mt-2 max-h-96 overflow-auto border border-line bg-[#f7f7f3] p-3 text-xs leading-5"
        >
          {draftJson}
        </pre>
      </details>

      {appliedSpec ? (
        <details>
          <summary className="cursor-pointer font-medium underline-offset-2 hover:underline">
            Show last applied JSON
          </summary>
          <pre
            id={appliedJsonId}
            tabIndex={0}
            aria-label="Last applied specification JSON from disk"
            className="mt-2 max-h-96 overflow-auto border border-line bg-[#f7f7f3] p-3 text-xs leading-5"
          >
            {formatSpecJson(appliedSpec)}
          </pre>
        </details>
      ) : null}
    </Card>
  )
}
