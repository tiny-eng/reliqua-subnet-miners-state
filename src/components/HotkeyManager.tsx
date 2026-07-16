'use client'

import { useState } from 'react'

const SS58_REGEX = /^5[A-HJ-NP-Za-km-z1-9]{47}$/

interface Props {
  hotkeys: string[]
  onAdd: (hk: string) => boolean
  autoPullTop: boolean
  onAutoPullChange: (v: boolean) => void
}

export default function HotkeyManager({
  hotkeys,
  onAdd,
  autoPullTop,
  onAutoPullChange,
}: Props) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function tryAdd(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (!SS58_REGEX.test(trimmed)) {
      setError('Not a valid SS58 hotkey (must start with 5 and be 48 chars).')
      return
    }
    if (hotkeys.includes(trimmed)) {
      setError('Already monitored.')
      return
    }
    if (onAdd(trimmed)) {
      setDraft('')
      setError(null)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    tryAdd(draft)
  }

  return (
    <div className="hotkey-manager card">
      <form onSubmit={onSubmit} className="hotkey-form">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Add miner hotkey (SS58, starts with 5...)"
          className="hotkey-input mono"
          spellCheck={false}
          autoComplete="off"
          aria-label="Hotkey to monitor"
        />
        <button type="submit" className="btn-primary" disabled={!draft.trim()}>
          Add hotkey
        </button>
      </form>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={autoPullTop}
          onChange={(e) => onAutoPullChange(e.target.checked)}
        />
        <span>Auto-pull top miners</span>
        <span className="toggle-hint muted">
          {autoPullTop
            ? 'on — adds the current top 3 every 10 min'
            : 'off — top-miner data is not pulled'}
        </span>
      </label>
      <div className="hotkey-meta muted">
        {hotkeys.length} hotkey{hotkeys.length === 1 ? '' : 's'} monitored
        {hotkeys.length > 0 ? ' . polling each every ~30s' : ''}
      </div>
    </div>
  )
}
