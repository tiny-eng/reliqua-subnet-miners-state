// Reliqua Bypass Cookie Courier — MV3 service worker.
//
// Why: reliqua.ai runs Vercel Attack Mode, which serves a JS bot challenge
// (403 + X-Vercel-Mitigated: challenge). Your browser solves it and receives a
// clearance cookie; the dashboard's Node `fetch` cannot. This worker reads
// reliqua.ai's cookies — including httpOnly ones, which only the cookies API can
// reach (a content script / document.cookie cannot) — and POSTs them to the
// dashboard's /api/bypass-cookie endpoint. The proxy replays them upstream.
//
// Usage: load unpacked, visit https://www.reliqua.ai once and pass the
// challenge. Cookies then sync on a 1-min timer, on any reliqua.ai cookie
// change, and when you click the toolbar icon. The badge shows OK / ERR / !.
//
// Point at a non-default dashboard with, in this worker's DevTools console:
//   chrome.storage.local.set({ dashboardUrl: 'http://localhost:3001' })

const DEFAULT_DASHBOARD_URL = 'http://localhost:3000'
const RELIQUA_DOMAIN = 'reliqua.ai'

async function dashboardUrl() {
  const { dashboardUrl } = await chrome.storage.local.get('dashboardUrl')
  return (dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/$/, '')
}

async function collectCookieHeader() {
  // domain filter returns cookies for reliqua.ai and its subdomains, httpOnly
  // included. De-dupe by name, then serialize to a Cookie header string.
  const cookies = await chrome.cookies.getAll({ domain: RELIQUA_DOMAIN })
  if (!cookies.length) return ''
  const byName = new Map()
  for (const c of cookies) byName.set(c.name, c.value)
  return [...byName.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text })
    await chrome.action.setBadgeBackgroundColor({ color })
  } catch {
    /* action may be unavailable during early startup */
  }
}

async function sync(reason) {
  let url
  try {
    url = await dashboardUrl()
    const cookie = await collectCookieHeader()
    if (!cookie) {
      console.warn('[reliqua-courier] no reliqua.ai cookies yet — open https://www.reliqua.ai and pass the challenge first')
      await setBadge('!', '#b91c1c')
      return
    }
    const res = await fetch(`${url}/api/bypass-cookie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie, userAgent: navigator.userAgent }),
    })
    if (!res.ok) throw new Error(`dashboard responded ${res.status}`)
    const data = await res.json().catch(() => ({}))
    console.log(`[reliqua-courier] synced ${data.cookieCount ?? '?'} cookies (${reason})`)
    await setBadge('OK', '#15803d')
  } catch (e) {
    console.error(`[reliqua-courier] sync failed (${reason}):`, (e && e.message) || e, '→', url)
    await setBadge('ERR', '#b91c1c')
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sync', { periodInMinutes: 1 })
  sync('installed')
})
chrome.runtime.onStartup.addListener(() => sync('startup'))
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'sync') sync('alarm')
})
chrome.action.onClicked.addListener(() => sync('manual'))
chrome.cookies.onChanged.addListener((info) => {
  const domain = info.cookie && info.cookie.domain
  if (domain && domain.includes(RELIQUA_DOMAIN)) sync('cookie-changed')
})
