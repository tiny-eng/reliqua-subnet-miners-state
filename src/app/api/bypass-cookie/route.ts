import { NextResponse } from 'next/server'
import { getBypass, setBypass } from '@/lib/bypassStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The companion extension is an out-of-origin caller (extension background
// context), so allow it to POST here. This is a LOCAL DEV convenience endpoint;
// a hostile page POSTing junk here can at worst break your own reliqua.ai
// fetches (they'd fall back to the challenge), so the open CORS is acceptable.
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function cookieCount(cookie: string): number {
  return cookie.split(';').filter((c) => c.includes('=')).length
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'bad_json', message: 'Body must be JSON: { cookie, userAgent? }' },
      { status: 400, headers: CORS },
    )
  }
  const { cookie, userAgent } = (body ?? {}) as { cookie?: unknown; userAgent?: unknown }
  if (typeof cookie !== 'string' || !cookie.trim()) {
    return NextResponse.json(
      { error: 'missing_cookie', message: 'Expected a non-empty "cookie" string.' },
      { status: 400, headers: CORS },
    )
  }
  setBypass(cookie, typeof userAgent === 'string' ? userAgent : null)
  return NextResponse.json({ ok: true, cookieCount: cookieCount(cookie) }, { headers: CORS })
}

export async function GET() {
  const s = getBypass()
  return NextResponse.json(
    {
      hasCookie: !!s.cookie,
      cookieCount: s.cookie ? cookieCount(s.cookie) : 0,
      // Names only (no values) — diagnostic to confirm the Vercel clearance
      // cookie (e.g. _vcrcs) is actually present in what the extension forwards.
      cookieNames: s.cookie
        ? s.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean)
        : [],
      userAgent: s.userAgent,
      updatedAt: s.updatedAt || null,
      ageSeconds: s.updatedAt ? Math.round((Date.now() - s.updatedAt) / 1000) : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
