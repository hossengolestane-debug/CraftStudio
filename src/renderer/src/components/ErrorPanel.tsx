import { useId, useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'

export function ErrorPanel({ error, onDismiss }: { error: AppErrorPayload; onDismiss?: () => void }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()

  return (
    <div
      role="alert"
      className="border border-[#8a1f1f] bg-[#fbf4f4] px-4 py-3 text-[#3d1010]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{error.message}</p>
          <p className="mt-1 text-[15px]">{error.action}</p>
        </div>
        {onDismiss ? (
          <button type="button" className="shrink-0 text-sm underline" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
      {error.details ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm underline"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Hide technical details' : 'Show technical details'}
          </button>
          {open ? (
            <pre
              id={detailsId}
              className="mt-2 max-h-48 overflow-auto border border-[#d8b4b4] bg-white p-3 text-xs leading-5 text-[#3d1010]"
            >
              {error.details}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
