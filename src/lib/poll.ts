'use client'

import { useEffect, useRef, useState } from 'react'
import type { MinerResponse } from './types'

// Subnet windows are ~60s (WINDOW_LENGTH 5 x 12s), so polling much faster than
// that just re-fetches identical data and hammers reliqua.ai's WAF into Attack
// Mode (which then challenges every request from this IP). ~30s ± 8s per hotkey
// keeps the data fresh-enough while keeping the per-IP request rate well under
// the bot-detection threshold even with many panels open.
const BASE_INTERVAL_MS = 30000
const JITTER_MS = 8000
const MAX_BACKOFF = 8

export interface PollState {
  data: MinerResponse | null
  error: Error | null
  lastFetchedAt: number
  inFlight: boolean
}

// Polls /api/miner/<hotkey> on a 7s ± 1.5s schedule. Aborts on unmount and on
// hotkey change. Exponential backoff (capped at 8x = ~56s base) on persistent
// upstream failure, reset on success.
export function useMinerPoll(hotkey: string): PollState {
  const [data, setData] = useState<MinerResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0)
  const [inFlight, setInFlight] = useState<boolean>(false)
  const backoffRef = useRef(1)

  useEffect(() => {
    if (!hotkey) return
    let cancelled = false
    const ac = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null

    setData(null)
    setError(null)
    setLastFetchedAt(0)
    backoffRef.current = 1

    const tick = async () => {
      if (cancelled) return
      setInFlight(true)
      try {
        const r = await fetch(`/api/miner/${encodeURIComponent(hotkey)}`, {
          signal: ac.signal,
          cache: 'no-store',
        })
        if (!r.ok) {
          // Try to read a structured error body so we can surface specific
          // upstream conditions (e.g. Vercel challenge) instead of "HTTP 503".
          let detail = `HTTP ${r.status}`
          try {
            const errJson = (await r.json()) as { error?: string; message?: string }
            if (errJson?.message) detail = errJson.message
            else if (errJson?.error) detail = errJson.error
          } catch {
            // body wasn't JSON; keep generic message
          }
          throw new Error(detail)
        }
        const json = (await r.json()) as MinerResponse
        if (cancelled) return
        setData(json)
        setError(null)
        setLastFetchedAt(Date.now())
        backoffRef.current = 1
      } catch (e) {
        if (cancelled) return
        const err = e as Error
        if (err.name === 'AbortError') return
        setError(err)
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF)
      } finally {
        if (!cancelled) {
          setInFlight(false)
          const base = BASE_INTERVAL_MS * backoffRef.current
          const jitter = Math.random() * JITTER_MS - JITTER_MS / 2
          timer = setTimeout(tick, Math.max(1000, base + jitter))
        }
      }
    }

    void tick()
    return () => {
      cancelled = true
      ac.abort()
      if (timer) clearTimeout(timer)
    }
  }, [hotkey])

  return { data, error, lastFetchedAt, inFlight }
}
