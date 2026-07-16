// In-memory store for a reliqua.ai "challenge clearance" cookie forwarded by the
// companion browser extension (see ../../extension). reliqua.ai runs Vercel
// Attack Mode, which serves a JS bot challenge; a real browser solves it and
// receives a clearance cookie, but a Node `fetch` cannot. The extension harvests
// reliqua.ai's cookies and POSTs them to /api/bypass-cookie, which lands here.
// The miner proxy then replays them as a `Cookie` header on its upstream fetch.
//
// Backed by globalThis so the value survives Next.js dev hot-reloads (a plain
// module-level variable would reset every time a route module is reloaded).
//
// NOTE: this is a single-process store — fine for `next dev` / `next start` /
// self-hosted, but it does NOT share across serverless instances.

export interface BypassState {
  cookie: string | null
  userAgent: string | null
  updatedAt: number
}

const g = globalThis as unknown as { __reliquaBypass?: BypassState }

function state(): BypassState {
  if (!g.__reliquaBypass) {
    g.__reliquaBypass = { cookie: null, userAgent: null, updatedAt: 0 }
  }
  return g.__reliquaBypass
}

export function setBypass(cookie: string | null, userAgent?: string | null): void {
  const s = state()
  s.cookie = cookie && cookie.trim() ? cookie.trim() : null
  if (userAgent && userAgent.trim()) s.userAgent = userAgent.trim()
  s.updatedAt = Date.now()
}

export function getBypass(): BypassState {
  return state()
}
