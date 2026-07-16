'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMinerPoll } from '@/lib/poll'
import { materializeStrip, mergeWindows } from '@/lib/slidingWindow'
import type { MinerResponse, WindowStatus } from '@/lib/types'

export interface HotkeySnapshot {
  data: MinerResponse | null
  error: Error | null
  lastFetchedAt: number
  inFlight: boolean
  strip: WindowStatus[]
  latestWindow: number
}

interface Props {
  hotkey: string
  onSnapshot: (hotkey: string, snap: HotkeySnapshot) => void
}

// Invisible per-hotkey controller. Owns the polling timer, the sliding-window
// Map, and the materialized strip. Streams every change upward via onSnapshot
// so a single parent can render both the chart strip and the stats table from
// the same data without double-polling.
export default function HotkeyController({ hotkey, onSnapshot }: Props) {
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
    const subnetCurrentWindow = data.current_window?.window ?? null
    const { merged, latestWindow: lw } = mergeWindows(
      mapRef.current,
      incoming,
      subnetCurrentWindow,
    )
    mapRef.current = merged
    setLatestWindow(lw)
    setVersion((v) => v + 1)
  }, [data])

  const strip = useMemo(
    () => materializeStrip(mapRef.current, latestWindow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latestWindow, version],
  )

  useEffect(() => {
    onSnapshot(hotkey, { data, error, lastFetchedAt, inFlight, strip, latestWindow })
  }, [hotkey, data, error, lastFetchedAt, inFlight, strip, latestWindow, onSnapshot])

  return null
}
