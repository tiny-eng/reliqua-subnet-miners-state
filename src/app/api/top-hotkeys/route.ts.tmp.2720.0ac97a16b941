import { NextResponse } from 'next/server'
import { CHALLENGE_MESSAGE, fetchUpstreamText, isVercelChallenge } from '@/lib/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOWS = 5 // last N windows (current .. current-4)
const TOP_N = 3
const CACHE_TTL_MS = 15_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

async function getJson(path: string): Promise<Json> {
  const r = await fetchUpstreamText(path)
  if (isVercelChallenge(r)) {
    const e = new Error(CHALLENGE_MESSAGE) as Error & { challenge?: boolean }
    e.challenge = true
    throw e
  }
  if (r.status < 200 || r.status >= 300) throw new Error(`upstream ${r.status} for ${path}`)
  return JSON.parse(r.body)
}

export interface TopResult {
  window: number
  windows: number[]
  top: Array<{ hotkey: string; accepted: number }>
  generatedAt: number
}

let cached: { value: TopResult; expiresAt: number } | null = null
let inflight: Promise<TopResult> | null = null

/**
 * Top hotkeys by ACCEPTED sample count over the last WINDOWS windows.
 *
 * `/api/miners` returns `current_window` plus a `windows[]` array of recent
 * window summaries (72 deep), each carrying its accepted `samples[]` with a
 * per-sample `hotkey`. So a SINGLE upstream call covers the last 5 windows —
 * we tally one per accepted sample per hotkey. (No need for 5 `?window=<w>`
 * fetches; that just re-centers the same payload.)
 */
async function compute(): Promise<TopResult> {
  const j = await getJson('/api/miners')
  const windowsArr: Json[] = Array.isArray(j?.windows) ? j.windows : []
  const current =
    typeof j?.current_window?.window === 'number'
      ? j.current_window.window
      : windowsArr.length
        ? Math.max(...windowsArr.map((w: Json) => w?.window).filter((n: Json) => typeof n === 'number'))
        : null
  if (current == null) throw new Error('could not determine current window from /api/miners')

  const lo = current - (WINDOWS - 1)
  const used = windowsArr.filter(
    (w: Json) => typeof w?.window === 'number' && w.window <= current && w.window >= lo,
  )

  const totals = new Map<string, number>()
  for (const w of used) {
    for (const s of w?.samples ?? []) {
      const hk = s?.hotkey
      if (typeof hk === 'string') totals.set(hk, (totals.get(hk) ?? 0) + 1)
    }
  }

  const top = [...totals.entries()]
    .map(([hotkey, accepted]) => ({ hotkey, accepted }))
    .sort((a, b) => b.accepted - a.accepted)
    .slice(0, TOP_N)

  return {
    window: current,
    windows: used.map((w: Json) => w.window).sort((a: number, b: number) => b - a),
    top,
    generatedAt: Date.now(),
  }
}

export async function GET(req: Request) {
  // Probe helper: ?raw[=<window>] returns the raw upstream JSON for inspection.
  if (new URL(req.url).searchParams.has('raw')) {
    const w = new URL(req.url).searchParams.get('raw')
    const path = w ? `/api/miners?window=${encodeURIComponent(w)}` : '/api/miners'
    const r = await fetchUpstreamText(path)
    return new NextResponse(r.body, {
      status: r.status,
      headers: { 'Content-Type': r.contentType, 'Cache-Control': 'no-store' },
    })
  }

  try {
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.value, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!inflight) {
      inflight = compute().finally(() => {
        inflight = null
      })
    }
    const value = await inflight
    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const err = e as Error & { challenge?: boolean }
    return NextResponse.json(
      { error: err.challenge ? 'upstream_challenge' : 'upstream_failed', message: err.message },
      { status: err.challenge ? 503 : 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
