import type { WindowStatus } from '@/lib/types'
import WindowColumn from './WindowColumn'

interface Props {
  windows: WindowStatus[]
  latestWindow: number
}

export default function WindowStrip({ windows, latestWindow }: Props) {
  const first = windows[0]?.window
  const last = windows[windows.length - 1]?.window
  // Accepted dots are split by environment (opencode green / openmath blue);
  // env='unknown' falls in with opencode since both render the generic green.
  const slotCounts = windows.reduce(
    (acc, w) => {
      for (const s of w.slots) {
        if (s === 'accepted') {
          if (w.env === 'openmath') acc.openmath++
          else if (w.env === 'opencode') acc.opencode++
          else acc.unknown++
        } else if (s === 'pooled') {
          acc.pooled++
        } else {
          acc[s]++
        }
      }
      return acc
    },
    { opencode: 0, openmath: 0, unknown: 0, pooled: 0, soft: 0, hard: 0, blank: 0 },
  )
  const windowsWithSubmissions = windows.filter((w) => w.submitted > 0).length
  return (
    <section className="strip-section">
      <div className="strip-header">
        <h2>Last 72 windows &middot; per-submission dots</h2>
        <span className="strip-range mono">
          w{first ?? '-'} &rarr; w{last ?? '-'}{' '}
          {latestWindow ? <span className="muted">(live: w{latestWindow})</span> : null}
        </span>
      </div>
      <div className="window-strip" aria-label="Last 72 windows, one column per window, one dot per submission">
        {windows.map((w) => (
          <WindowColumn key={w.window} status={w} />
        ))}
      </div>
      <div className="legend" aria-hidden="true">
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--opencode)' }} />
          opencode accepted ({slotCounts.opencode})
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--openmath)' }} />
          openmath accepted ({slotCounts.openmath})
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--accepted)' }} />
          accepted, environment unknown ({slotCounts.unknown})
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--pooled)' }} />
          accepted into pool ({slotCounts.pooled})
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--soft)' }} />
          soft-failed ({slotCounts.soft})
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--hard)' }} />
          hard-failed ({slotCounts.hard})
        </span>
        <span className="legend-item muted">
          {windowsWithSubmissions} / {windows.length} windows with submissions
        </span>
      </div>
    </section>
  )
}
