import { reasonSeverity } from './reasons'
import type { Bucket, Env, SubmissionVerdict, WindowDetail, WindowStatus } from './types'

// Protocol cap from reliquary docs: MAX_SUBMISSIONS_PER_HOTKEY_PER_WINDOW = 8.
export const MAX_SLOTS_PER_WINDOW = 8

// OpenCodeInstruct exposes a sample's `ground_truth` as a 16-char hex case-id
// (a sha256 prefix — see reliquary/environment/opencodeinstruct.py:get_problem),
// whereas OpenMathInstruct's `ground_truth` is the literal math answer ("37.5",
// "2(6x+5)(2x+3)", "135000"; see openmathinstruct.py). The upstream
// /api/miners window_detail carries no task_source, so this shape is the only
// reliable per-window environment signal. We require at least one hex *letter*
// so a (vanishingly rare) 16-digit integer math answer can't masquerade as a
// case-id. Each window runs a single environment, so any one sample classifies
// the whole window.
const OPENCODE_CASE_ID_RE = /^[0-9a-f]{16}$/

function isOpencodeCaseId(groundTruth: unknown): boolean {
  return (
    typeof groundTruth === 'string' &&
    OPENCODE_CASE_ID_RE.test(groundTruth) &&
    /[a-f]/.test(groundTruth)
  )
}

// Infer the window's environment from its surfaced samples. 'unknown' when no
// sample is present (the dot still renders, just with the default accepted
// color). acc>0 windows always carry a sample in practice, so accepted dots are
// always classifiable.
function detectEnv(r: WindowDetail): Env {
  const samples = r.samples ?? []
  if (samples.length === 0) return 'unknown'
  for (const s of samples) {
    if (isOpencodeCaseId(s?.ground_truth)) return 'opencode'
  }
  return 'openmath'
}

function bucketCounts(r: WindowDetail): {
  accepted: number
  soft: number
  hard: number
  submitted: number
} {
  return {
    accepted: r.accepted ?? 0,
    soft: r.soft_failed ?? 0,
    hard: r.hard_failed ?? 0,
    submitted: r.submitted ?? 0,
  }
}

// Per-window reject tally from miner_reject_reasons (the genuine per-window,
// per-miner reject breakdown — note /api/miners?window= carries only a
// CUMULATIVE reject_reasons, so it can't drive per-window verticals).
// batch_filled is benign (lost the slot) -> brown ring; every other reason is
// integrity / behavioural -> red ring.
function rejectCounts(r: WindowDetail): { batchFilled: number; otherRejects: number } {
  let batchFilled = 0
  let otherRejects = 0
  for (const [reason, count] of Object.entries(r.miner_reject_reasons ?? {})) {
    if (reason === 'batch_filled') batchFilled += count
    else otherRejects += count
  }
  return { batchFilled, otherRejects }
}

// One dot per actual submission, ordered bottom-up by severity:
//   index 0 (bottom) ... accepted ... soft ... hard ... (top) index N-1
// Capped at MAX_SLOTS_PER_WINDOW = 8 per protocol.
function buildSlots(accepted: number, soft: number, hard: number): Bucket[] {
  const slots: Bucket[] = []
  for (let i = 0; i < accepted; i++) slots.push('accepted')
  for (let i = 0; i < soft; i++) slots.push('soft')
  for (let i = 0; i < hard; i++) slots.push('hard')
  return slots.slice(0, MAX_SLOTS_PER_WINDOW)
}

// Summary bucket for tooltip + accent purposes. Accept-dominant priority:
// any acceptance wins the window; otherwise red beats brown beats blank.
// Rejects participate so a reject-only window isn't styled 'blank'.
function summaryBucket(
  accepted: number,
  pooled: number,
  soft: number,
  hard: number,
  submitted: number,
  batchFilled: number,
  otherRejects: number,
): Bucket {
  if (submitted === 0 && accepted + soft + hard + batchFilled + otherRejects === 0) return 'blank'
  if (accepted > 0) return 'accepted'
  if (pooled > 0) return 'pooled'
  if (hard > 0 || otherRejects > 0) return 'hard'
  if (soft > 0 || batchFilled > 0) return 'soft'
  return 'blank'
}

export function classifyWindow(r: WindowDetail): WindowStatus {
  const { accepted, soft, hard, submitted } = bucketCounts(r)
  const { batchFilled, otherRejects } = rejectCounts(r)
  const slots = buildSlots(accepted, soft, hard)
  const bucket = summaryBucket(accepted, 0, soft, hard, submitted, batchFilled, otherRejects)

  let topReason: string | null = null
  if (r.miner_reject_reasons) {
    const entries = Object.entries(r.miner_reject_reasons)
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1])
      topReason = entries[0][0]
    }
  }

  return {
    window: r.window,
    bucket,
    env: detectEnv(r),
    submitted,
    poolAccepted: accepted,
    accepted,
    soft,
    hard,
    score: r.score ?? 0,
    avgSelectedSigma: null,
    selectedSigmaSum: 0,
    selectedSigmaCount: 0,
    topReason,
    createdAt: r.created_at ?? null,
    slots,
    slotEnvs: slots.map((slot) => (slot === 'accepted' ? detectEnv(r) : 'unknown')),
    batchFilled,
    otherRejects,
  }
}

export function classifyVerdictWindow(
  window: number,
  submissions: SubmissionVerdict[],
  fallback?: WindowStatus,
): WindowStatus {
  const inWindow = submissions.filter((s) => s.window_n === window)
  if (inWindow.length === 0 && fallback) return fallback

  let accepted = 0
  let poolAccepted = 0
  let soft = 0
  let hard = 0
  let batchFilled = 0
  let topReason: string | null = null
  const selectedSigmas: number[] = []
  for (const submission of inWindow) {
    if (submission.accepted) {
      poolAccepted++
      if (submission.selected_for_batch === true) {
        accepted++
        if (typeof submission.sigma === 'number' && Number.isFinite(submission.sigma)) {
          selectedSigmas.push(submission.sigma)
        }
      }
      continue
    }
    if (submission.reason.toUpperCase() === 'BATCH_FILLED') batchFilled++
    else if (reasonSeverity(submission.reason) === 'soft') soft++
    else hard++
    topReason = submission.reason
  }

  const submitted = inWindow.length
  const otherRejects = soft + hard
  const slots: Bucket[] = []
  for (let i = 0; i < accepted; i++) slots.push('accepted')
  for (let i = accepted; i < poolAccepted; i++) slots.push('pooled')
  for (let i = 0; i < soft; i++) slots.push('soft')
  for (let i = 0; i < hard; i++) slots.push('hard')

  return {
    window,
    bucket: summaryBucket(
      accepted,
      poolAccepted - accepted,
      soft,
      hard,
      submitted,
      batchFilled,
      otherRejects,
    ),
    env: fallback?.env ?? 'unknown',
    submitted,
    poolAccepted,
    accepted,
    soft,
    hard,
    score: fallback?.score ?? 0,
    avgSelectedSigma: selectedSigmas.length
      ? selectedSigmas.reduce((sum, sigma) => sum + sigma, 0) / selectedSigmas.length
      : null,
    selectedSigmaSum: selectedSigmas.reduce((sum, sigma) => sum + sigma, 0),
    selectedSigmaCount: selectedSigmas.length,
    topReason,
    createdAt: fallback?.createdAt ?? null,
    slots: slots.slice(0, MAX_SLOTS_PER_WINDOW),
    slotEnvs: slots
      .slice(0, MAX_SLOTS_PER_WINDOW)
      .map((slot) => (slot === 'accepted' ? fallback?.env ?? 'unknown' : 'unknown')),
    batchFilled,
    otherRejects,
  }
}
