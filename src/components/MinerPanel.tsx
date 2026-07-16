'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMinerPoll } from '@/lib/poll'
import { materializeStrip, mergeWindows } from '@/lib/slidingWindow'
import type { WindowStatus } from '@/lib/types'
import MinerHeader from './MinerHeader'
import StatsRow from './StatsRow'
import WindowStrip from './WindowStrip'
import RejectBreakdown from './RejectBreakdown'

interface Props {
  hotkey: string
  onRemove?: (hotkey: string) => void
}

export default function MinerPanel({ hotkey, onRemove }: Props) {
  const { data, error, lastFetchedAt, inFlight } = useMinerPoll(hotkey)
  const mapRef = useRef<Map<number, WindowStatus>>(new Map())
  const [latestWindow, setLatestWindow] = useState(0)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    mapRef.current = new Map()
    setLatestWindow(0)
    setVersion((v) => v + 1)
  }, [hotkey])

  useEffect(() => {
    if (!data) return
    const incoming = data.window_detail ?? []
    const { merged, latestWindow: lw } = mergeWindows(mapRef.current, incoming)
    mapRef.current = merged
    setLatestWindow(lw)
    setVersion((v) => v + 1)
  }, [data])

  const strip = useMemo(
    () => materializeStrip(mapRef.current, latestWindow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latestWindow, version],
  )

  return (
    <section className="miner-panel">
      <MinerHeader
        hotkey={hotkey}
        miner={data?.miner}
        lastFetchedAt={lastFetchedAt}
        error={error}
        inFlight={inFlight}
        onRemove={onRemove ? () => onRemove(hotkey) : undefined}
      />
      {error && !data ? (
        <div className="error-banner">
          Failed to reach validator API: {error.message}. Retrying with backoff.
        </div>
      ) : null}
      <StatsRow miner={data?.miner} currentWindow={data?.current_window} />
      <WindowStrip windows={strip} latestWindow={latestWindow} />
      <RejectBreakdown reasons={data?.miner?.reject_reasons} />
    </section>
  )
}
