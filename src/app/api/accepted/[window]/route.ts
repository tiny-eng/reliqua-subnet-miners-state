import { NextResponse } from 'next/server'
import {
  CHALLENGE_MESSAGE,
  fetchUpstreamText,
  isVercelChallenge,
  upstreamBase,
} from '@/lib/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ window: string }> },
) {
  const { window } = await ctx.params
  if (!/^\d+$/.test(window)) {
    return NextResponse.json(
      { error: 'invalid_window', message: 'Window must be a positive integer.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const response = await fetchUpstreamText(`/api/live/windows/${window}/accepted`)
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
        url: `${upstreamBase()}/api/live/windows/${window}/accepted`,
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}