// Shared upstream (reliqua.ai) proxy helpers. Centralizes the browser-spoof
// headers, the optional Vercel protection-bypass token, and the challenge-
// clearance cookie forwarded by the companion extension (see ../../extension)
// / RELIQUA_COOKIE — so every proxy route shares ONE copy of the cookie logic.

import { getBypass } from '@/lib/bypassStore'

// Minimum a real Chrome would send, so reliqua.ai's Vercel WAF doesn't flag the
// server fetch as an obvious bot before the cookie is even considered.
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
}

export const CHALLENGE_MESSAGE =
  'reliqua.ai is serving a Vercel bot challenge from this network. Set RELIQUA_BYPASS_TOKEN in .env.local with the Vercel protection-bypass secret to skip it, or wait for the challenge to clear.'

export function upstreamBase(): string {
  return (process.env.RELIQUA_BASE_URL ?? 'https://www.reliqua.ai').replace(/\/$/, '')
}

export function buildUpstreamHeaders(): Record<string, string> {
  const headers: Record<string, string> = { ...BROWSER_HEADERS }
  const base = upstreamBase()
  headers.Referer = `${base}/`
  headers.Origin = base
  // Operator-issued Vercel protection-bypass token (if any).
  const bypass = process.env.RELIQUA_BYPASS_TOKEN
  if (bypass) {
    headers['x-vercel-protection-bypass'] = bypass
    headers['x-vercel-set-bypass-cookie'] = 'true'
  }
  // Challenge-clearance cookie from the extension / RELIQUA_COOKIE. Match the
  // forwarded browser User-Agent since the clearance can be UA-bound.
  const runtimeBypass = getBypass()
  const cookie = process.env.RELIQUA_COOKIE ?? runtimeBypass.cookie
  if (cookie) {
    headers['Cookie'] = cookie
    if (!process.env.RELIQUA_COOKIE && runtimeBypass.userAgent) {
      headers['User-Agent'] = runtimeBypass.userAgent
    }
  }
  return headers
}

export interface UpstreamResult {
  body: string
  status: number
  contentType: string
}

// Fetch an upstream path ("/api/..." or absolute URL), returning the raw text.
export async function fetchUpstreamText(path: string, timeoutMs = 15_000): Promise<UpstreamResult> {
  const url = path.startsWith('http')
    ? path
    : `${upstreamBase()}${path.startsWith('/') ? '' : '/'}${path}`
  const upstream = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: buildUpstreamHeaders(),
    redirect: 'follow',
  })
  const body = await upstream.text()
  return {
    body,
    status: upstream.status,
    contentType: upstream.headers.get('content-type') ?? 'application/json',
  }
}

export function isVercelChallenge(r: { status: number; body: string }): boolean {
  if (r.status !== 403) return false
  return r.body.includes('Vercel Security Checkpoint') || r.body.includes('X-Vercel-Mitigated')
}
