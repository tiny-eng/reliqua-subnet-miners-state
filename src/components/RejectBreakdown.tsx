import { reasonSeverity } from '@/lib/reasons'

interface Props {
  reasons: Record<string, number> | undefined
}

export default function RejectBreakdown({ reasons }: Props) {
  if (!reasons || Object.keys(reasons).length === 0) return null
  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1])
  const max = entries[0][1]
  return (
    <section className="card reject-breakdown">
      <h2>Reject reasons (aggregate)</h2>
      {entries.map(([reason, count]) => {
        const sev = reasonSeverity(reason)
        const pctWidth = max > 0 ? (count / max) * 100 : 0
        return (
          <div key={reason} className="reject-row">
            <span className="mono">{reason}</span>
            <span className="reject-bar">
              <span
                className="reject-bar-fill"
                data-sev={sev}
                style={{ width: `${pctWidth}%` }}
              />
            </span>
            <span className="reject-count mono">{count}</span>
          </div>
        )
      })}
    </section>
  )
}
