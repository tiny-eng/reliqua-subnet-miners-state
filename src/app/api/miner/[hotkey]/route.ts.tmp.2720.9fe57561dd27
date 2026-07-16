import { NextResponse } from 'next/server'
import {
  CHALLENGE_MESSAGE,
  fetchUpstreamText,
  isVercelChallenge,
  upstreamBase,
} from '@/lib/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SS58_REGEX = /^5[A-HJ-NP-Za-km-z1-9]{47}$/

// Tiny per-process cache so multiple hotkey panels polling at once don't pile
// up duplicate upstream hits, and so a transient 403 doesn't wipe state we
// already have. TTL is short — we still want freshness.
interface CacheEntry {
  body: string
  status: number
  contentType: string
  expiresAt: number
}
// 20s so multiple panels/tabs watching the same hotkey coalesce into one
// upstream hit per cache window (data only changes ~every 60s window anyway).
const CACHE_TTL_MS = 20_000
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CacheEntry>>()

async function fetchUpstream(hotkey: string): Promise<CacheEntry> {
  const r = await fetchUpstreamText(`/api/miners/${hotkey}`)
  return { ...r, expiresAt: Date.now() + CACHE_TTL_MS }
}

async function getEntry(hotkey: string): Promise<CacheEntry> {
  const now = Date.now()
  const hit = cache.get(hotkey)
  if (hit && hit.expiresAt > now) return hit

  const existing = inflight.get(hotkey)
  if (existing) return existing

  const promise = fetchUpstream(hotkey)
    .then((entry) => {
      // Only cache successful responses; let errors retry on the next poll so
      // a transient challenge doesn't get stuck in cache for TTL ms.
      if (entry.status >= 200 && entry.status < 300) {
        cache.set(hotkey, entry)
      } else {
        cache.delete(hotkey)
      }
      return entry
    })
    .finally(() => {
      inflight.delete(hotkey)
    })
  inflight.set(hotkey, promise)
  return promise
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ hotkey: string }> },
) {
  const { hotkey } = await ctx.params

  if (!SS58_REGEX.test(hotkey)) {
    return NextResponse.json(
      { error: 'invalid_hotkey', message: 'Hotkey must be a valid SS58 address.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const entry = await getEntry(hotkey)

    if (isVercelChallenge(entry)) {
      return NextResponse.json(
        { error: 'upstream_challenge', message: CHALLENGE_MESSAGE, upstreamStatus: 403 },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return new NextResponse(entry.body, {
      status: entry.status,
      headers: {
        'Content-Type': entry.contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const err = e as Error
    return NextResponse.json(
      {
        error: 'upstream_failed',
        message: err.message,
        url: `${upstreamBase()}/api/miners/${hotkey}`,
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
