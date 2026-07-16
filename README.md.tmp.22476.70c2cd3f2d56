# Reliquary miner dashboard

Live submission-status heatbar for a single Bittensor subnet 81 miner.

Polls `https://www.reliqua.ai/api/miners/<hotkey>` every ~7s and renders the last
72 windows as a strip of colored dots:

| Color  | Bucket       | Trigger                                              |
| ------ | ------------ | ---------------------------------------------------- |
| green  | accepted     | `accepted > 0` for that window                       |
| brown  | soft-failed  | only `soft_failed > 0` (transient / retry-friendly)  |
| red    | hard-failed  | `hard_failed > 0` and no acceptance                  |
| blank  | no submission | window absent or `submitted == 0`                   |

When the validator publishes a new window, the oldest entry on the left drops
off automatically — the strip always shows exactly the trailing 72 windows.

## Run

```powershell
cd d:\Work\Bittensor\Reliquadotai\reliquary-evaluation\dashboard
npm install
npm run dev
# open http://localhost:3000
```

Override the hotkey via URL:

```
http://localhost:3000?hotkey=5SomeOtherSS58Address...
```

Or set the default in `.env.local` (copy `.env.local.example`):

```
NEXT_PUBLIC_DEFAULT_HOTKEY=5HGr6joke42gGZxMHsDTuJEepnmbaihM7KdUwVtq2kA6TNAN
RELIQUA_BASE_URL=https://www.reliqua.ai
```

## Design notes

- **Proxy route** at `/api/miner/[hotkey]` — sidesteps CORS, lets us set
  `Cache-Control: no-store`, and gives us server-side log visibility when
  the upstream schema drifts. Validates the hotkey against the SS58 regex
  before issuing the upstream fetch (defense in depth against SSRF).
- **Sliding window** lives in a `Map<number, WindowStatus>` ref so that
  per-poll merges don't trigger render churn. A `version` counter forces
  the re-render after each merge. The right edge is anchored to
  `max(seen_window)` across all polls; a transient empty response never
  shifts the strip backwards.
- **Soft / hard reason split** mirrors `reliquary/protocol/submission.py`.
  Unknown reasons default to `hard` (over-flag, never silently miss).
- **One dot per window**, not one per submission slot. A window with up to
  `MAX_SUBMISSIONS_PER_HOTKEY_PER_WINDOW = 8` rollouts collapses to a single
  best-of color (accepted > hard > soft > blank). Tooltip surfaces the
  underlying counts and the top reject reason.

## Files

```
src/
├── app/
│   ├── layout.tsx            root layout
│   ├── page.tsx              server shell, reads ?hotkey=
│   ├── globals.css           dark theme + dot grid CSS
│   └── api/miner/[hotkey]/route.ts   proxy to reliqua.ai
├── components/
│   ├── MinerDashboard.tsx    client orchestrator
│   ├── MinerHeader.tsx
│   ├── StatsRow.tsx
│   ├── WindowStrip.tsx
│   ├── WindowDot.tsx
│   └── RejectBreakdown.tsx
└── lib/
    ├── types.ts              MinerResponse / WindowDetail / WindowStatus
    ├── reasons.ts            SOFT_FAIL_REASONS / HARD_FAIL_REASONS sets
    ├── classify.ts           WindowDetail -> Bucket
    ├── slidingWindow.ts      mergeWindows / materializeStrip
    └── poll.ts               useMinerPoll hook
```

## Upstream bot challenge (Vercel)

reliqua.ai is hosted on Vercel. Under load (or sometimes on cold IPs), Vercel's
Attack Challenge Mode serves a `403` HTML page with `X-Vercel-Mitigated: challenge`
on every request — including from server-side fetches. A browser solves it with
JS; a `fetch` from Node cannot.

The proxy detects this and surfaces it to the UI as:

> reliqua.ai is serving a Vercel bot challenge from this network...

Mitigations the operator of *this* dashboard can apply:

- If reliqua.ai's owner gives you a **Vercel protection-bypass token**, set it
  in `.env.local`:

  ```
  RELIQUA_BYPASS_TOKEN=<paste-secret-here>
  ```

  The proxy then sends `x-vercel-protection-bypass: <token>` on every upstream
  request and Vercel skips the challenge entirely.

- **No token? Use the cookie-courier extension** (`./extension`). A real browser
  solves the challenge and gets a clearance cookie; the extension forwards
  reliqua.ai's cookies (httpOnly included) to `POST /api/bypass-cookie`, and the
  proxy replays them as a `Cookie` header (+ your browser `User-Agent`) upstream.
  Load it unpacked, visit reliqua.ai once, and the proxy stops getting
  challenged. See [`extension/README.md`](./extension/README.md). You can also
  paste a cleared cookie statically via `RELIQUA_COOKIE` in `.env.local`.

  ```
  Browser (solves challenge) ─cookies→ extension ─POST→ /api/bypass-cookie ─Cookie→ reliqua.ai ✅
  ```

  Caveat: the clearance is bound to the solving client's IP + UA, so run the
  dashboard on the same machine as the browser.

- Otherwise, reduce polling frequency or the number of simultaneous hotkeys —
  Vercel's challenge often clears after a quiet period. The proxy already
  caches successful responses for ~4s in-process so multiple panels coalesce
  into one upstream hit.

## Known limits

- API has no pagination; the upstream returns only what it returns
  (typically ~30 to ~72 recent windows). Older windows render as blank
  until they age off entirely.
- Reject-reason enum drift: when `reliquary/protocol/submission.py` adds a
  new variant, classify it in `src/lib/reasons.ts`.
