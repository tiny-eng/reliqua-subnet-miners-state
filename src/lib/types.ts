export type Bucket = 'accepted' | 'pooled' | 'soft' | 'hard' | 'blank'

// Which evaluation environment a window ran. Each window runs exactly one
// environment (one validator, one task_source), so this is per-window, not
// per-submission. 'unknown' = no sample available to classify (e.g. a window
// with rejects but no surfaced sample).
export type Env = 'opencode' | 'openmath' | 'unknown'

export interface WindowDetail {
  window: number
  created_at: string | null
  score: number
  submitted: number
  accepted: number
  soft_failed: number
  hard_failed: number
  response_time_ms: number | null
  window_reject_summary?: Record<string, number> | null
  miner_reject_reasons?: Record<string, number> | null
  miner_rejection_details?: Array<{
    prompt_idx: number
    reason: string
    sketch_diff_max: number | null
    lp_dev_max: number | null
    dist_q10_min: number | null
  }>
  samples?: Array<{
    prompt_idx: number
    prompt: string
    ground_truth: string
    completion_text: string
    reward: number
    completion_length: number
    eos_terminated: boolean
    sigma: number
  }>
}

export interface MinerStats {
  hotkey: string
  coldkey?: string
  uid?: number
  window?: number
  score?: number
  rank?: number
  rollout_count?: number
  valid_rollouts?: number
  unique_rollouts?: number
  unique_ratio?: number
  avg_reward?: number
  success_rate?: number
  hard_failed?: number
  soft_failed?: number
  stability?: number
  streak?: number
  participation?: number
  trend?: string
  trend_slope?: number
  share_of_emission?: number
  estimated_daily_tao?: number
  cumulative_tao?: number
  upload_lag_ms?: number | null
  upload_lag_p50_ms?: number
  upload_lag_p95_ms?: number
  response_time_ms?: number | null
  response_time_p50_ms?: number
  response_time_p95_ms?: number
  last_seen?: string
  status?: string
  role?: string
  reject_reasons?: Record<string, number>
  reject_sample_total?: number
  reject_windows_seen?: number
}

export interface CurrentWindow {
  window?: number
  block_start?: number
  block_end?: number
  total_miners?: number
  total_rollouts?: number
  total_accepted?: number
  avg_score?: number
  validator_hotkey?: string
}

export interface SubmissionVerdict {
  merkle_root: string
  window_n: number
  accepted: boolean
  reason: string
  ts: number
  accepted_into_pool?: boolean | null
  selected_for_batch?: boolean | null
  rewarded?: boolean | null
  sigma?: number | null
  status?: string
}

export interface VerdictResponse {
  verdicts?: SubmissionVerdict[]
  submissions?: SubmissionVerdict[]
  event_count?: number
  submission_count?: number
}

export interface LadderRow {
  hotkey: string
  selected?: boolean
  status?: string
}

export interface LadderEnvironment {
  env_name: string
  rows?: LadderRow[]
}

export interface LadderResponse {
  window?: number
  environments?: LadderEnvironment[]
}

export interface MinerResponse {
  source?: string
  generated_at?: string
  hotkey?: string
  miner?: MinerStats
  history?: Array<{ window: number; score: number }>
  current_window?: CurrentWindow
  window_detail?: WindowDetail[]
  verdicts?: VerdictResponse
  ladderEnvironments?: Record<number, Env>
}

export interface WindowStatus {
  window: number
  bucket: Bucket
  // Evaluation environment this window ran (opencode / openmath), inferred from
  // the window's sample ground_truth shape. Drives the accepted-dot color:
  // green for opencode, blue for openmath. See classify.ts:detectEnv.
  env: Env
  submitted: number
  // Total accepted into the pool, including exact selected submissions.
  poolAccepted: number
  accepted: number
  soft: number
  hard: number
  score: number
  topReason: string | null
  createdAt: string | null
  // Per-submission buckets for this window, ordered bottom-up: accepted first,
  // then soft, then hard. Length is min(accepted + soft + hard, MAX_SLOTS_PER_WINDOW).
  slots: Bucket[]
  // Per-window reject tally (from miner_reject_reasons), rendered as bordered
  // circles in the window column: batch_filled (brown) vs every other reason (red).
  batchFilled: number
  otherRejects: number
}
