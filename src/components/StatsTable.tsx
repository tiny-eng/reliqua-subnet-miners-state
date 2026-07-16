import type { Bucket } from '@/lib/types'
import type { HotkeySnapshot } from './HotkeyController'
import HotkeyCell from './HotkeyCell'

interface Props {
  hotkeys: string[]
  snapshots: Record<string, HotkeySnapshot | undefined>
  onRemove: (hotkey: string) => void
}

function shortHotkey(hk: string): string {
  if (hk.length <= 14) return hk
  return `${hk.slice(0, 6)}...${hk.slice(-6)}`
}

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-'
  return n.toFixed(digits)
}

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-'
  return `${(n * 100).toFixed(1)}%`
}

function ms(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-'
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`
  return `${Math.round(n)}ms`
}

function fmtRelative(target: number): string {
  if (target <= 0) return '-'
  const diff = Date.now() - target
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / 3_600_000)}h ago`
}

function countSlots(snap: HotkeySnapshot | undefined): Record<Bucket, number> {
  const out: Record<Bucket, number> = { accepted: 0, soft: 0, hard: 0, blank: 0 }
  if (!snap) return out
  for (const w of snap.strip) {
    for (const s of w.slots) out[s]++
  }
  return out
}

export default function StatsTable({ hotkeys, snapshots, onRemove }: Props) {
  return (
    <section className="stats-table-section card">
      <div className="section-header">
        <h2>Miner stats</h2>
        <span className="muted">{hotkeys.length} hotkey{hotkeys.length === 1 ? '' : 's'}</span>
      </div>
      <div className="stats-table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Hotkey</th>
              <th>UID</th>
              <th>Rank</th>
              <th>Status</th>
              <th className="num">Score</th>
              <th className="num">Success</th>
              <th className="num">Streak</th>
              <th className="num" title="Accepted / soft-failed / hard-failed dots in the last 72 windows">
                Acc/Soft/Hard
              </th>
              <th className="num">Emission</th>
              <th className="num">TAO/day</th>
              <th className="num" title="Response time p50 / p95">
                Resp p50/p95
              </th>
              <th className="num" title="Upload lag p50 / p95">
                Lag p50/p95
              </th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hotkeys.map((hk) => {
              const snap = snapshots[hk]
              const m = snap?.data?.miner
              const counts = countSlots(snap)
              const status = snap?.error ? 'error' : m?.status ?? '...'
              return (
                <tr key={hk}>
                  <td>
                    <HotkeyCell hotkey={hk} display={shortHotkey(hk)} />
                  </td>
                  <td className="num">{m?.uid ?? '-'}</td>
                  <td className="num">{typeof m?.rank === 'number' ? `#${m.rank}` : '-'}</td>
                  <td>
                    <span className="status-pill" data-status={status}>
                      {status}
                    </span>
                  </td>
                  <td className="num">{fmt(m?.score)}</td>
                  <td className="num">{pct(m?.success_rate)}</td>
                  <td className="num">{m?.streak ?? '-'}</td>
                  <td className="num mono">
                    <span style={{ color: 'var(--accepted)' }}>{counts.accepted}</span>
                    {' / '}
                    <span style={{ color: 'var(--soft)' }}>{counts.soft}</span>
                    {' / '}
                    <span style={{ color: 'var(--hard)' }}>{counts.hard}</span>
                  </td>
                  <td className="num">{pct(m?.share_of_emission)}</td>
                  <td className="num">{fmt(m?.estimated_daily_tao, 4)}</td>
                  <td className="num">
                    {ms(m?.response_time_p50_ms)} / {ms(m?.response_time_p95_ms)}
                  </td>
                  <td className="num">
                    {ms(m?.upload_lag_p50_ms)} / {ms(m?.upload_lag_p95_ms)}
                  </td>
                  <td className="num">
                    {snap?.lastFetchedAt ? fmtRelative(snap.lastFetchedAt) : '-'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => onRemove(hk)}
                      title={`Remove ${hk}`}
                      aria-label={`Remove ${hk}`}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
