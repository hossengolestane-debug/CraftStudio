import { ComingSoon } from '../components/ui'

export function AssetsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Assets</h1>
      <ComingSoon title="Texture and asset editors are not in Phase 1" phase="Later phase">
        <p>There is no texture painter, model editor, or sound importer yet.</p>
        <p>The Assets item is visible so the shell matches the product map. Its actions stay disabled.</p>
        <button type="button" className="mt-2 border border-line px-3 py-2 text-muted" disabled>
          Open texture editor (unavailable)
        </button>
      </ComingSoon>
    </div>
  )
}
