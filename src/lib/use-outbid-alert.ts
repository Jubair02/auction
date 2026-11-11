'use client'

// "You've been outbid" for a team manager: the moment another team bids over
// their lead, the phone vibrates, a short beep plays (unless muted) and, if
// the tab is in the background, its title says so. The bid console shows a
// banner until the manager leads again or the player leaves the block.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { outbidChange, type BidSnapshot } from '@/lib/room-state'

export interface OutbidAlert {
  byTeam: string
  amount: number
}

const SOUND_KEY = 'ng_outbid_sound'
const soundListeners = new Set<() => void>()

function readSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

/** The manager's "beep when outbid" choice (on by default), shared by every component that reads it. */
export function useOutbidSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      soundListeners.add(cb)
      return () => soundListeners.delete(cb)
    },
    readSoundOn,
    () => true,
  )
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
    } catch {
      // storage unavailable: the choice lasts until the page closes
    }
    for (const cb of soundListeners) cb()
  }, [])
  return [on, set]
}

let audio: AudioContext | null = null

/** Two short rising beeps. Browsers allow it once the page has been tapped (a manager has bid). */
function beep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    if (audio.state === 'suspended') void audio.resume()
    const start = audio.currentTime + 0.01
    for (const [i, freq] of [660, 880].entries()) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      const t0 = start + i * 0.16
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13)
      osc.connect(gain).connect(audio.destination)
      osc.start(t0)
      osc.stop(t0 + 0.14)
    }
  } catch {
    // no audio on this device — the vibration and banner still work
  }
}

/** Shows `text` as a background tab's title until the user comes back; returns an undo. */
function flagTitle(text: string): () => void {
  const original = document.title
  document.title = `⚠ ${text}`
  const restore = () => {
    if (document.hidden) return
    document.title = original
    document.removeEventListener('visibilitychange', restore)
  }
  document.addEventListener('visibilitychange', restore)
  return () => {
    document.removeEventListener('visibilitychange', restore)
    document.title = original
  }
}

/**
 * The active outbid alert for `myTeamId` (null when there is none).
 *
 * Fed by EVERY room update as it arrives (`subscribe`, from useAuctionSocket),
 * not by what happens to get rendered: in a fast bidding war on a slow phone
 * two updates can land in one render, and a lead that was lost in between
 * must still sound the alarm. `titleFor` is the background tab's title text.
 */
export function useOutbidAlert(
  subscribe: (listener: (snap: BidSnapshot) => void) => () => void,
  myTeamId: string | undefined,
  titleFor: (team: string) => string,
): OutbidAlert | null {
  const [soundOn] = useOutbidSound()
  const [alert, setAlert] = useState<OutbidAlert | null>(null)
  // Read at alarm time, without re-subscribing when they change.
  const soundRef = useRef(soundOn)
  const titleRef = useRef(titleFor)
  useEffect(() => {
    soundRef.current = soundOn
    titleRef.current = titleFor
  }, [soundOn, titleFor])

  useEffect(() => {
    if (!myTeamId) return
    let prev: BidSnapshot | null = null
    let alerted = false
    let undoTitle: (() => void) | null = null
    const off = subscribe((snap) => {
      const change = outbidChange(prev, snap, myTeamId, alerted)
      prev = snap
      if (!change) return
      if (change.type === 'clear') {
        alerted = false
        setAlert(null)
        return
      }
      alerted = true
      setAlert({ byTeam: change.byTeam, amount: change.amount })
      if (change.type !== 'outbid') return
      // The alarm itself — once per lost lead.
      try {
        navigator.vibrate?.([180, 90, 180])
      } catch {
        // not supported
      }
      if (soundRef.current) beep()
      if (document.hidden) {
        undoTitle?.()
        undoTitle = flagTitle(titleRef.current(change.byTeam))
      }
    })
    return () => {
      off()
      undoTitle?.()
      setAlert(null)
    }
  }, [subscribe, myTeamId])

  return myTeamId ? alert : null
}
