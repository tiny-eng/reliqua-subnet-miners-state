import type { MinerStats } from '@/lib/types'

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
  miner: MinerStats | undefined
  lastFetchedAt: number
  error: Error | null
  inFlight: boolean
  onRemove?: () => void
}

export default function MinerHeader({
  hotkey,
  miner,
  lastFetchedAt,
  error,
  inFlight,
  onRemove,
}: Props) {
  const status = error ? 'error' : miner?.status ?? '...'
  const liveState = error ? 'error' : inFlight ? 'polling' : 'idle'
  const lastUpdate = lastFetchedAt ? fmtRelative(Date.now() - lastFetchedAt) : 'never'
  return (
    <div className="header-bar">
      <div>
        <h1>
          <span className="mono" title={hotkey}>
            {shortHotkey(hotkey)}
          </span>{' '}
          <span className="status-pill" data-status={status}>
            {status}
          </span>
        </h1>
        <div className="header-meta">
          {typeof miner?.uid === 'number' ? <span>uid {miner.uid}</span> : null}
          {typeof miner?.rank === 'number' ? <span>rank #{miner.rank}</span> : null}
          {typeof miner?.streak === 'number' ? <span>streak {miner.streak}</span> : null}
          {miner?.trend ? <span>trend {miner.trend}</span> : null}
        </div>
      </div>
      <div className="header-meta">
        <span className="live-indicator">
          <span className="live-dot" data-state={liveState} />
          {error ? `error: ${error.message}` : `updated ${lastUpdate}`}
        </span>
        {onRemove ? (
          <button
            type="button"
            className="btn-remove"
            onClick={onRemove}
            aria-label={`Remove ${hotkey}`}
            title="Remove this hotkey"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}
