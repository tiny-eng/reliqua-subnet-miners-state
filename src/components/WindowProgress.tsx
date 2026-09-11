'use client'

import { useEffect, useRef, useState } from 'react'

interface StateResponse {
  state?: string
  window_n?: number
  valid_submissions?: number
  fill_closed?: {
    phase?: string
    precommit_seconds?: number
    max_window_seconds?: number
    picks_emitted?: number
    picks_target?: number
    admitted?: Record<string, number>
    proven?: Record<string, number>
    in_flight?: Record<string, number>
    remaining?: Record<string, number>
  }
}

const ENVIRONMENTS = [
  ['openmathinstruct', 'Math'],
  ['opencodeinstruct', 'Code'],
  ['reliquary_logic_v2', 'Logic'],
] as const

function totalFor(
  values: Record<string, number> | undefined,
  environment: string,
): number {
  return values?.[environment] ?? 0
}

function formatSeconds(seconds: number | undefined): string {
  if (!Number.isFinite(seconds)) return '-'
  const value = Math.max(0, Math.round(seconds as number))
  return `${Math.floor(value / 60)}m ${value % 60}s`
}

export default function WindowProgress() {
  const [data, setData] = useState<StateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [windowStartedAt, setWindowStartedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const observedWindowRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const next = (await response.json()) as StateResponse
        if (!cancelled) {
          const receivedAt = Date.now()
          if (next.window_n !== observedWindowRef.current) {
            observedWindowRef.current = next.window_n
            setWindowStartedAt(receivedAt)
          }
          setData(next)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    void load()
    const timer = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])

  const fill = data?.fill_closed
  const duration = fill?.max_window_seconds ?? 0
  const elapsed = windowStartedAt > 0 ? Math.floor((now - windowStartedAt) / 1_000) : 0
  const timePercent = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0
  const picks = fill?.picks_emitted ?? 0
  const pickTarget = fill?.picks_target ?? 0
  const pickPercent = pickTarget > 0 ? Math.min(100, (picks / pickTarget) * 100) : 0

  return (
    <section className="window-progress card" aria-label="Current window progress">
      <div className="window-progress-heading">
        <div>
          <div className="stat-label">Current window</div>
          <div className="window-progress-title">
            <span className="mono">w{data?.window_n ?? '-'}</span>
            <span className="status-pill" data-status={data?.state ?? 'unknown'}>
              {fill?.phase ?? data?.state ?? (error ? 'unavailable' : 'loading')}
            </span>
          </div>
        </div>
        <div className="window-progress-summary">
          <span>{data?.valid_submissions ?? 0} valid submissions</span>
          <span>{formatSeconds(Math.max(0, duration - elapsed))} remaining</span>
        </div>
      </div>
      {error ? <div className="muted">State unavailable: {error}</div> : null}
      <div className="progress-metrics">
        <div className="progress-metric">
          <div className="progress-label"><span>Window time</span><span>{formatSeconds(elapsed)} / {formatSeconds(duration)}</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${timePercent}%` }} /></div>
        </div>
        <div className="progress-metric">
          <div className="progress-label"><span>Picks</span><span>{picks} / {pickTarget}</span></div>
          <div className="progress-track"><div className="progress-fill progress-fill-accent" style={{ width: `${pickPercent}%` }} /></div>
        </div>
      </div>
      <div className="environment-progress">
        {ENVIRONMENTS.map(([key, label]) => {
          const admitted = totalFor(fill?.admitted, key)
          const proven = totalFor(fill?.proven, key)
          const inFlight = totalFor(fill?.in_flight, key)
          const remaining = totalFor(fill?.remaining, key)
          return (
            <div key={key} className="environment-progress-row">
              <span>{label}</span>
              <span className="mono">{proven} proven / {inFlight} in flight / {remaining} left</span>
              <span className="muted">{admitted} admitted</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}