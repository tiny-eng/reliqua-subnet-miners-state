import type { CurrentWindow, MinerStats } from '@/lib/types'

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

interface Props {
  miner: MinerStats | undefined
  currentWindow: CurrentWindow | undefined
}

export default function StatsRow({ miner, currentWindow }: Props) {
  return (
    <div className="stats-grid">
      <div className="stat">
        <div className="stat-label">Score</div>
        <div className="stat-value">{fmt(miner?.score)}</div>
        <div className="stat-subvalue">avg reward {fmt(miner?.avg_reward)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Success rate</div>
        <div className="stat-value">{pct(miner?.success_rate)}</div>
        <div className="stat-subvalue">participation {pct(miner?.participation)}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Rollouts</div>
        <div className="stat-value">{miner?.rollout_count ?? '-'}</div>
        <div className="stat-subvalue">
          valid {miner?.valid_rollouts ?? '-'} / unique {pct(miner?.unique_ratio)}
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Soft / hard failed</div>
        <div className="stat-value">
          {miner?.soft_failed ?? '-'} / {miner?.hard_failed ?? '-'}
        </div>
        <div className="stat-subvalue">{miner?.reject_sample_total ?? 0} rejects total</div>
      </div>
      <div className="stat">
        <div className="stat-label">Emission share</div>
        <div className="stat-value">{pct(miner?.share_of_emission)}</div>
        <div className="stat-subvalue">~{fmt(miner?.estimated_daily_tao)} TAO/day</div>
      </div>
      <div className="stat">
        <div className="stat-label">Response time p50/p95</div>
        <div className="stat-value">
          {ms(miner?.response_time_p50_ms)} / {ms(miner?.response_time_p95_ms)}
        </div>
        <div className="stat-subvalue">
          upload lag {ms(miner?.upload_lag_p50_ms)} / {ms(miner?.upload_lag_p95_ms)}
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Subnet window</div>
        <div className="stat-value">{currentWindow?.window ?? '-'}</div>
        <div className="stat-subvalue">
          {currentWindow?.total_miners ?? '-'} miners /{' '}
          {currentWindow?.total_accepted ?? '-'} acc this window
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Cumulative TAO</div>
        <div className="stat-value">{fmt(miner?.cumulative_tao)}</div>
        <div className="stat-subvalue">stability {fmt(miner?.stability, 2)}</div>
      </div>
    </div>
  )
}
