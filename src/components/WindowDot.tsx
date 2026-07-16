import type { Bucket, Env } from '@/lib/types'

// One submission slot inside a window column. Pure presentational.
// `env` only affects accepted dots: green for opencode, blue for openmath
// (see globals.css). soft/hard/blank ignore it.
export default function WindowDot({ bucket, env }: { bucket: Bucket; env?: Env }) {
  const envAttr = bucket === 'accepted' && env && env !== 'unknown' ? env : undefined
  return <span className="dot" data-bucket={bucket} data-env={envAttr} aria-hidden="true" />
}
