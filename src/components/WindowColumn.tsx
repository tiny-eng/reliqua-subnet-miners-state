import { MAX_SLOTS_PER_WINDOW } from '@/lib/classify'
import type { WindowStatus } from '@/lib/types'
import WindowDot from './WindowDot'

const LABEL_BY_BUCKET: Record<WindowStatus['bucket'], string> = {
  accepted: 'accepted',
  pooled: 'accepted into pool',
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

// One window = one vertical column with normal submission dots and at most one
// marker per failure kind.
export default function WindowColumn({ status }: { status: WindowStatus }) {
  const {
    bucket,
    env,
    window,
    submitted,
    poolAccepted,
    accepted,
    soft,
    hard,
    score,
    avgSelectedSigma,
    topReason,
    createdAt,
    slots,
    otherRejects,
  } = status
  const failureKinds = [
    hard > 0 ? 'hard' : null,
    soft > 0 ? 'soft' : null,
    otherRejects > 0 ? 'other' : null,
  ].filter((kind): kind is 'hard' | 'soft' | 'other' => kind !== null)
  const totalRejects = otherRejects
  const envLabel = LABEL_BY_ENV[env]
  const lines = [
    `window ${window} - ${LABEL_BY_BUCKET[bucket]}`,
    envLabel ? `env: ${envLabel}` : null,
    submitted === 0
      ? null
      : `submitted ${submitted} / exact ${accepted} / pool ${poolAccepted} / soft ${soft} / hard ${hard}`,
    failureKinds.length
      ? `failed: ${failureKinds.join(', ')} (soft ${soft}, hard ${hard}, other ${otherRejects})`
      : null,
    avgSelectedSigma == null ? null : `avg selected sigma ${avgSelectedSigma.toFixed(3)}`,
    submitted === 0 ? null : `score ${score.toFixed(3)}`,
    topReason ? `top reason: ${topReason}` : null,
    createdAt ? relativeTime(createdAt) : null,
  ].filter(Boolean) as string[]
  const tooltip = lines.join('\n')
  const aria =
    submitted === 0 && failureKinds.length === 0
      ? `Window ${window}: no submission`
      : `Window ${window}: ${accepted} exact accepted, ${poolAccepted} accepted into pool, ${soft} soft-failed, ${hard} hard-failed, ${totalRejects} rejected of ${submitted} submitted${avgSelectedSigma == null ? '' : `, average selected sigma ${avgSelectedSigma.toFixed(3)}`}`
  const visibleSlots = slots
    .filter((slot) => slot === 'accepted' || slot === 'pooled')
    .slice(0, MAX_SLOTS_PER_WINDOW)
  return (
    <div
      className="window-col"
      role="img"
      aria-label={aria}
      title={tooltip}
      data-bucket={bucket}
    >
      {visibleSlots.map((slot, index) => (
        <WindowDot key={`slot-${index}`} bucket={slot} env={env} />
      ))}
      {failureKinds.map((kind) => (
        <span key={kind} className="failure-dot" data-kind={kind} aria-hidden="true" />
      ))}
    </div>
  )
}
