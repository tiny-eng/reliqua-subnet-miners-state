# Reliqua Bypass Cookie Courier (browser extension)

A tiny MV3 extension that gets the dashboard past reliqua.ai's Vercel **Attack
Mode** bot challenge **without a Vercel protection-bypass token**.

## Why it's needed

reliqua.ai serves a JS bot challenge (`403` + `X-Vercel-Mitigated: challenge`).
A real browser solves it and gets a **clearance cookie**; the dashboard's
server-side `fetch` (Node) cannot solve JS, so it stays challenged.

This extension reads reliqua.ai's cookies — **including `httpOnly` ones, which
only the `chrome.cookies` API can reach** (a content script reading
`document.cookie` cannot) — and forwards them to the dashboard's
`/api/bypass-cookie` endpoint. The proxy then replays them as a `Cookie` header
(plus your browser's `User-Agent`) on every upstream request, so reliqua.ai
treats the server fetch as your already-cleared browser.

```
Browser (solves challenge) ──cookies──▶ extension ──POST /api/bypass-cookie──▶ dashboard proxy ──Cookie header──▶ reliqua.ai ✅
```

## Install

1. Start the dashboard (`npm run dev`, default `http://localhost:3000`).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select this `extension/` folder.
5. Open <https://www.reliqua.ai> in a tab and pass the challenge once.

The toolbar badge shows status: **OK** synced · **!** no cookies yet (visit
reliqua.ai) · **ERR** dashboard unreachable. Click the icon to force a sync.

## How it stays fresh

Re-syncs automatically: every 1 min (alarm), whenever a reliqua.ai cookie
changes, on browser startup, and on icon click. Verify what the dashboard holds:

```bash
curl http://localhost:3000/api/bypass-cookie
# { "hasCookie": true, "cookieCount": 3, "ageSeconds": 12, ... }
```

## Configuration

Default dashboard URL is `http://localhost:3000`. To change it, open the
extension's service-worker console (`chrome://extensions` → this extension →
*Inspect views: service worker*) and run:

```js
chrome.storage.local.set({ dashboardUrl: 'http://localhost:3001' })
```

## Caveats

- **Same machine / egress IP.** Vercel's clearance is bound to the client that
  solved it (IP + UA). Run the dashboard on the same machine as the browser so
  the proxy goes out the same IP; the extension forwards your real UA already.
- **Expiry.** Clearance cookies expire; the auto-resync handles refresh as long
  as the browser still has a valid cookie. If reliqua.ai re-challenges you,
  reload it in a tab and pass again.
- **Active attack.** If reliqua.ai is under a real, actively-detected attack,
  even browser clearance gets re-challenged constantly — nothing client-side
  fixes that.
- **Workaround, not a sanctioned bypass.** Keep polling gentle. The stable
  long-term fix is still a Vercel protection-bypass token (`RELIQUA_BYPASS_TOKEN`)
  from the reliqua.ai operator. See the dashboard README.
- **Single-process only.** The dashboard stores the cookie in memory; works for
  local/self-hosted, not across serverless instances.
