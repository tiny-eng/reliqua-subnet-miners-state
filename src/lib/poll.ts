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
    const isInRows = environment.rows?.some((row) => row.hotkey === hotkey)
    const isRejected = environment.rejected?.some((entry) => entry.hotkey === hotkey)
    if (isInRows || isRejected) {
      if (environment.env_name === 'openmathinstruct') return 'openmath'
      if (environment.env_name === 'opencodeinstruct') return 'opencode'
    }
  }
  return 'unknown'
}

// Polls the miner and verdict APIs on a 30s ± 8s schedule. Ladder responses
// are cached by window, so only windows first seen in a verdict response are
// fetched. Aborts on unmount and on hotkey change.
export function useMinerPoll(hotkey: string): PollState {
  const [data, setData] = useState<MinerResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0)
  const [inFlight, setInFlight] = useState<boolean>(false)
  const backoffRef = useRef(1)
  const ladderCacheRef = useRef<Map<number, Env>>(new Map())

  useEffect(() => {
    if (!hotkey) return
    let cancelled = false
    const ac = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null

    setData(null)
    setError(null)
    setLastFetchedAt(0)
    backoffRef.current = 1
    ladderCacheRef.current = new Map()

    const tick = async () => {
      if (cancelled) return
      setInFlight(true)
      try {
        const [minerResponse, verdictResponse] = await Promise.all([
          fetch(`/api/miner/${encodeURIComponent(hotkey)}`, {
            signal: ac.signal,
            cache: 'no-store',
          }),
          fetch(`/api/verdicts/${encodeURIComponent(hotkey)}`, {
            signal: ac.signal,
            cache: 'no-store',
          }),
        ])
        if (!verdictResponse.ok) {
          let detail = `HTTP ${verdictResponse.status}`
          try {
            const errJson = (await verdictResponse.json()) as { error?: string; message?: string }
            if (errJson?.message) detail = errJson.message
            else if (errJson?.error) detail = errJson.error
          } catch {
            // body wasn't JSON; keep generic message
          }
          throw new Error(detail)
        }
        const minerJson = minerResponse.ok
          ? (await minerResponse.json()) as MinerResponse
          : null
        const json = makeVerdictData((await verdictResponse.json()) as VerdictResponse)
        const combined: MinerResponse = {
          ...json,
          ...minerJson,
          window_detail: json.window_detail,
          verdicts: json.verdicts,
        }
        const windows = json.verdicts?.submissions
          ?.map((submission) => submission.window_n)
          .filter((window, index, all) => Number.isFinite(window) && all.indexOf(window) === index)
          ?? []
        await Promise.all(
          windows.map(async (window) => {
            if (ladderCacheRef.current.has(window)) return
            try {
              const ladderResponse = await fetch(`/api/ladder/${window}`, {
                signal: ac.signal,
                cache: 'no-store',
              })
              if (ladderResponse.ok) {
                ladderCacheRef.current.set(window, ladderEnv(
                  (await ladderResponse.json()) as LadderResponse,
                  hotkey,
                ))
              }
            } catch {
              // Verdict data remains usable if ladder lookup fails.
            }
          }),
        )
        combined.ladderEnvironments = Object.fromEntries(ladderCacheRef.current)
        if (cancelled) return
        setData(combined)
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
