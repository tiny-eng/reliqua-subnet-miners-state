import type { WindowStatus } from '@/lib/types'
import WindowColumn from './WindowColumn'

function shortHotkey(hk: string): string {
  if (hk.length <= 14) return hk
  return `${hk.slice(0, 6)}...${hk.slice(-6)}`
}

function fmtRelative(ms: number): string {
  if (ms <= 0) return ''
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  return `${Math.round(ms / 3_600_000)}h ago`
}

interface Props {
  hotkey: string
  uid?: number
  strip: WindowStatus[]
  latestWindow: number
  status: string
  inFlight: boolean
  error: Error | null
  lastFetchedAt: number
}

// One compact strip row in the top charts section. Header carries enough
// signal to identify the miner without duplicating the full stats table.
export default function ChartRow({
  hotkey,
  uid,
  strip,
  latestWindow,
  status,
  inFlight,
  error,
  lastFetchedAt,
}: Props) {
  const liveState = error ? 'error' : inFlight ? 'polling' : 'idle'
  const lastUpdate = lastFetchedAt ? fmtRelative(Date.now() - lastFetchedAt) : '...'
  // Show the uid as the card label; fall back to the short hotkey until the
  // miner data (which carries the uid) has loaded. Full hotkey stays on hover.
  const label = uid != null ? `uid ${uid}` : shortHotkey(hotkey)
  const activeWindowCount = strip.filter((window) => window.submitted > 0).length
  const selectedSubmissionSum = strip.reduce((sum, window) => sum + window.accepted, 0)
  const averageSelectedSubmissions =
    activeWindowCount > 0 ? selectedSubmissionSum / 72 : null
  return (
    <div className="chart-row">
      <div className="chart-row-header">
        <span className="mono chart-row-hk" title={hotkey}>
          {label}
        </span>
        <span className="status-pill" data-status={error ? 'error' : status}>
          {error ? 'error' : status}
        </span>
        <span className="muted chart-row-window mono">
          {latestWindow > 0 ? `w${latestWindow}` : 'no data yet'}
        </span>
        <span className="muted chart-row-value mono">
          selected submissions: {selectedSubmissionSum} / active windows: {activeWindowCount} / avg(submissions / 72):{' '}
          {averageSelectedSubmissions == null ? 'n/a' : averageSelectedSubmissions.toFixed(2)}
        </span>
        <span className="live-indicator">
          <span className="live-dot" data-state={liveState} />
          {error ? error.message : lastUpdate}
        </span>
      </div>
      <div className="window-strip" aria-label={`${hotkey} last 72 windows`}>
        {strip.map((w) => (
          <WindowColumn key={w.window} status={w} />
        ))}
      </div>
    </div>
  )
}
