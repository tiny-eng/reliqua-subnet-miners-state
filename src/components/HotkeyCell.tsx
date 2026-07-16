'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  hotkey: string
  display: string
}

async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy path
    }
  }
  // Legacy fallback for non-secure contexts or browsers without the async API.
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function HotkeyCell({ hotkey, display }: Props) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const onClick = useCallback(async () => {
    const ok = await writeToClipboard(hotkey)
    if (!ok) return
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 1400)
  }, [hotkey])

  return (
    <button
      type="button"
      className="hotkey-cell mono"
      onClick={onClick}
      title={copied ? 'Copied to clipboard' : `${hotkey}\nClick to copy`}
      aria-label={`Copy hotkey ${hotkey}`}
      data-copied={copied ? '' : undefined}
    >
      <span className="hotkey-cell-text">{display}</span>
      <span className="hotkey-cell-badge" aria-hidden="true">
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  )
}
