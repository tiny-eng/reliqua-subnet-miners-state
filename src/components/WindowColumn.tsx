import { MAX_SLOTS_PER_WINDOW } from '@/lib/classify'
import type { WindowStatus } from '@/lib/types'
import WindowDot from './WindowDot'

const LABEL_BY_BUCKET: Record<WindowStatus['bucket'], string> = {
  accepted: 'accepted',
  soft: 'soft-failed',
  hard: 'hard-failed',
  blank: 'no submission',
}

const LABEL_BY_ENV: Record<WindowStatus['env'], string> = {
  opencode: 'opencode',
  openmath: 'openmath',
  unknown: '',
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const ms = Date.now() - t
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

// One window = one vertical column. Bottom-up (the column is column-reverse):
// filled dots for each actual submission (accepted/soft/hard), then ABOVE them
// the reject tally as bordered circles — brown for batch_filled, red for every
// other reason — from this window's miner_reject_reasons.
export default function WindowColumn({ status }: { status: WindowStatus }) {
  const {
    bucket,
    env,
    window,
    submitted,
    accepted,
    soft,
    hard,
    score,
    topReason,
    createdAt,
    slots,
    batchFilled,
    otherRejects,
  } = status
  const totalRejects = batchFilled + otherRejects
  const envLabel = LABEL_BY_ENV[env]
  const lines = [
    `window ${window} - ${LABEL_BY_BUCKET[bucket]}`,
    envLabel ? `env: ${envLabel}` : null,
    submitted === 0
      ? null
      : `submitted ${submitted} / acc ${accepted} / soft ${soft} / hard ${hard}`,
    totalRejects > 0
      ? `rejects ${totalRejects}: ${batchFilled} batch-filled (brown), ${otherRejects} other (red)`
      : null,
    submitted === 0 ? null : `score ${score.toFixed(3)}`,
    topReason ? `top reason: ${topReason}` : null,
    createdAt ? relativeTime(createdAt) : null,
  ].filter(Boolean) as string[]
  const tooltip = lines.join('\n')
  const aria =
    submitted === 0 && totalRejects === 0
      ? `Window ${window}: no submission`
      : `Window ${window}: ${accepted} accepted, ${soft} soft-failed, ${hard} hard-failed, ${totalRejects} rejected of ${submitted} submitted`
  const visibleSlots = slots.slice(0, MAX_SLOTS_PER_WINDOW)
  const rejectKinds = [
    ...Array<string>(batchFilled).fill('batch_filled'),
    ...Array<string>(otherRejects).fill('other'),
  ].slice(0, MAX_SLOTS_PER_WINDOW)
  return (
    <div
      className="window-col"
      role="img"
      aria-label={aria}
      title={tooltip}
      data-bucket={bucket}
    >
      {visibleSlots.map((b, i) => (
        <WindowDot key={i} bucket={b} env={env} />
      ))}
      {rejectKinds.map((kind, i) => (
        <span key={`rej-${i}`} className="reject-dot" data-kind={kind} aria-hidden="true" />
      ))}
    </div>
  )
}
