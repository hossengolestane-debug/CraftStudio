import { LiveActivityFeed } from '../components/LiveActivityFeed'

export function ActivityPage() {
  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="border-b border-line px-5 py-4">
        <h1 className="text-xl font-semibold">Live Activity</h1>
        <p className="mt-1 text-sm text-muted">
          Shared event bus with the main window. Opening this view does not start inference, file writes, or Gradle.
          Pause display does not cancel work.
        </p>
        <p className="mt-1 text-xs text-muted">
          Export contains timestamps, request/build IDs, titles, models, generation settings, bounded messages, file
          paths, diffs, and allowlisted Gradle command lines. Secrets are redacted. Full prompts only if persist-full
          AI logs was enabled.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <LiveActivityFeed enabled />
      </div>
    </div>
  )
}
