'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  Env,
  LadderResponse,
  MinerResponse,
  SubmissionVerdict,
  VerdictResponse,
  WindowDetail,
} from './types'

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

function dedupeSubmissions(response: VerdictResponse): SubmissionVerdict[] {
  const source = Array.isArray(response.submissions)
    ? response.submissions
    : Array.isArray(response.verdicts)
      ? response.verdicts
      : []
  const unique = new Map<string, SubmissionVerdict>()
  for (const submission of source) {
    if (typeof submission?.merkle_root === 'string') unique.set(submission.merkle_root, submission)
  }
  return [...unique.values()]
}

function makeVerdictData(response: VerdictResponse): MinerResponse {
  const submissions = dedupeSubmissions(response)
  const windows = [...new Set(submissions.map((submission) => submission.window_n))]
    .filter((window) => Number.isFinite(window))
    .sort((a, b) => a - b)
  const windowDetail: WindowDetail[] = windows.map((window) => ({
    window,
    created_at: null,
    score: 0,
    submitted: submissions.filter((submission) => submission.window_n === window).length,
    accepted: 0,
    soft_failed: 0,
    hard_failed: 0,
    response_time_ms: null,
  }))
  return {
    source: 'verdicts',
    current_window: { window: windows.length ? Math.max(...windows) : undefined },
    window_detail: windowDetail,
    verdicts: { ...response, submissions },
  }
}

function ladderEnv(response: LadderResponse, hotkey: string): Env {
  for (const environment of response.environments ?? []) {
    if (environment.rows?.some((row) => row.hotkey === hotkey)) {
      if (environment.env_name === 'openmathinstruct') return 'openmath'
      if (environment.env_name === 'opencodeinstruct') return 'opencode'
    }
  }
  return 'unknown'
}

// Polls /api/verdicts/<hotkey> on a 30s ± 8s schedule. Aborts on unmount and on
// hotkey change. Exponential backoff (capped at 8x) on persistent upstream
// failure, reset on success.
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
        const r = await fetch(`/api/verdicts/${encodeURIComponent(hotkey)}`, {
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
        const json = makeVerdictData((await r.json()) as VerdictResponse)
        const ladderEnvironments: Record<number, Env> = {}
        const windows = json.verdicts?.submissions
          ?.map((submission) => submission.window_n)
          .filter((window, index, all) => Number.isFinite(window) && all.indexOf(window) === index)
          ?? []
        await Promise.all(
          windows.map(async (window) => {
            try {
              const ladderResponse = await fetch(`/api/ladder/${window}`, {
                signal: ac.signal,
                cache: 'no-store',
              })
              if (ladderResponse.ok) {
                ladderEnvironments[window] = ladderEnv(
                  (await ladderResponse.json()) as LadderResponse,
                  hotkey,
                )
              }
            } catch {
              // Verdict data remains usable if ladder lookup fails.
            }
          }),
        )
        json.ladderEnvironments = ladderEnvironments
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
