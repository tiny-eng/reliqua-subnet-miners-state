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
    const response = await fetchUpstreamText(`/api/verdicts/${hotkey}`)
    if (isVercelChallenge(response)) {
      return NextResponse.json(
        { error: 'upstream_challenge', message: CHALLENGE_MESSAGE, upstreamStatus: 403 },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const err = e as Error
    return NextResponse.json(
      {
        error: 'upstream_failed',
        message: err.message,
        url: `${upstreamBase()}/api/verdicts/${hotkey}`,
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}