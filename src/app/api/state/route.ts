import { NextResponse } from 'next/server'
import { fetchUpstreamText, stateUrl } from '@/lib/upstream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const response = await fetchUpstreamText(stateUrl())
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
      { error: 'upstream_failed', message: err.message, url: stateUrl() },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}