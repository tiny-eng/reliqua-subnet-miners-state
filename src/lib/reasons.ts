// Reject-reason classification, mirrored from reliquary/protocol/submission.py.
// Soft = transient / environmental (retry-friendly); the miner's intent was sound.
// Hard = miner-side bug, adversarial behavior, or proof divergence.
// If you see a new reason string in production that maps to neither set, the
// classifier defaults it to HARD (safer for an ops dashboard — over-flag rather
// than silently miss a real fault).

export const SOFT_FAIL_REASONS: ReadonlySet<string> = new Set([
  'WRONG_CHECKPOINT',
  'BATCH_FILLED',
  'WINDOW_NOT_ACTIVE',
  'WORKER_DROPPED',
  'RATE_LIMITED',
  'WINDOW_MISMATCH',
  'PROMPT_FULL',
  'STALE_ROUND',
  'FUTURE_ROUND',
  'PROMPT_IN_COOLDOWN',
])

export const HARD_FAIL_REASONS: ReadonlySet<string> = new Set([
  'GRAIL_FAIL',
  'LOGPROB_MISMATCH',
  'REWARD_MISMATCH',
  'WRONG_RANDOMNESS',
  'OUT_OF_ZONE',
  'BAD_TERMINATION',
  'DISTRIBUTION_SUSPICIOUS',
  'BAD_SCHEMA',
  'BAD_TOKENS',
  'PROMPT_MISMATCH',
  'BAD_SIGNATURE',
  'BAD_PROMPT_IDX',
  'WRONG_ROLLOUT_COUNT',
  'HASH_DUPLICATE',
  'SUPERSEDED',
  'BAD_ENVELOPE_SIGNATURE',
  'TOKENS_MISMATCH',
  'BOXED_ANSWER_TAMPERED',
  'TOKEN_TAMPERED',
  'MALFORMED_FINAL_ANSWER',
  'REWARD_SHAPE_SUSPICIOUS',
  'REWARD_DISTRIBUTION',
])

export function reasonSeverity(reason: string): 'soft' | 'hard' {
  const k = reason.toUpperCase()
  if (SOFT_FAIL_REASONS.has(k)) return 'soft'
  if (HARD_FAIL_REASONS.has(k)) return 'hard'
  return 'hard'
}
