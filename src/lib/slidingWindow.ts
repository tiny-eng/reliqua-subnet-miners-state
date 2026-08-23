import { classifyVerdictWindow, classifyWindow } from './classify'
import type { Env, SubmissionVerdict, WindowDetail, WindowStatus } from './types'

export const WINDOW_CAPACITY = 72

// Merge a fresh poll into the existing Map and prune anything outside the
// trailing 72-window window.
//
// The right edge is anchored to the SUBNET's current window when provided
// (data.current_window.window), so a hotkey that hasn't submitted in a while
// shows trailing blanks all the way up to "now" instead of stopping at their
// last submission. We also fold in incoming/prev max so a transient empty
// API response can't make the strip jump backwards.
export function mergeWindows(
  prev: Map<number, WindowStatus>,
  incoming: WindowDetail[],
  currentWindow?: number | null,
  verdicts?: SubmissionVerdict[],
  ladderEnvironments?: Record<number, Env>,
): { merged: Map<number, WindowStatus>; latestWindow: number } {
  const next = new Map(prev)

  for (const rec of incoming) {
    if (typeof rec?.window !== 'number') continue
    const fallback = classifyWindow(rec)
    const classified = verdicts
      ? classifyVerdictWindow(rec.window, verdicts, fallback)
      : fallback
    if (ladderEnvironments?.[rec.window]) classified.env = ladderEnvironments[rec.window]
    next.set(rec.window, classified)
  }

  let incomingMax = -Infinity
  for (const r of incoming) {
    if (typeof r?.window === 'number' && r.window > incomingMax) incomingMax = r.window
  }
  let prevMax = -Infinity
  for (const w of prev.keys()) {
    if (w > prevMax) prevMax = w
  }
  const candidates: number[] = [incomingMax, prevMax]
  if (typeof currentWindow === 'number' && Number.isFinite(currentWindow)) {
    candidates.push(currentWindow)
  }
  const latestWindow = Math.max(...candidates)
  if (!Number.isFinite(latestWindow)) return { merged: next, latestWindow: 0 }

  const cutoff = latestWindow - (WINDOW_CAPACITY - 1)
  for (const w of [...next.keys()]) {
    if (w < cutoff) next.delete(w)
  }

  return { merged: next, latestWindow }
}

// Build a dense length-72 array for render. Missing entries become 'blank'.
// Order: index 0 = oldest, index 71 = newest (reading left -> right).
export function materializeStrip(
  merged: Map<number, WindowStatus>,
  latestWindow: number,
): WindowStatus[] {
  if (latestWindow <= 0) {
    return Array.from({ length: WINDOW_CAPACITY }, (_, i) => emptySlot(-WINDOW_CAPACITY + i + 1))
  }
  const start = latestWindow - (WINDOW_CAPACITY - 1)
  const out: WindowStatus[] = []
  for (let w = start; w <= latestWindow; w++) {
    out.push(merged.get(w) ?? emptySlot(w))
  }
  return out
}

function emptySlot(window: number): WindowStatus {
  return {
    window,
    bucket: 'blank',
    env: 'unknown',
    submitted: 0,
    poolAccepted: 0,
    accepted: 0,
    soft: 0,
    hard: 0,
    score: 0,
    topReason: null,
    createdAt: null,
    slots: [],
    batchFilled: 0,
    otherRejects: 0,
  }
}
