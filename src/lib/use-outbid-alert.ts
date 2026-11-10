'use client'

// "You've been outbid" for a team manager: the moment another team bids over
// their lead, the phone vibrates, a short beep plays (unless muted) and, if
// the tab is in the background, its title says so. The bid console shows a
// banner until the manager leads again or the player leaves the block.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { outbidChange, type BidSnapshot } from '@/lib/room-state'
import type { RoomState } from '@/lib/types'

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

function snapshotOf(state: RoomState | null): BidSnapshot | null {
  if (!state) return null
  const bid = state.currentBid
  return {
    status: state.status,
    playerId: state.currentPlayer?.id ?? null,
    bid: bid ? { teamId: bid.teamId, teamName: bid.teamName, amount: bid.amount } : null,
  }
}

const sameSnapshot = (a: BidSnapshot | null, b: BidSnapshot) =>
  !!a && a.status === b.status && a.playerId === b.playerId && a.bid?.teamId === b.bid?.teamId && a.bid?.amount === b.bid?.amount

/**
 * The active outbid alert for `myTeamId` (null when there is none). `titleText`
 * is what a background tab's title shows when the alarm fires.
 */
export function useOutbidAlert(state: RoomState | null, myTeamId: string | undefined, titleText: string): OutbidAlert | null {
  const [soundOn] = useOutbidSound()
  // Derived from successive broadcasts while rendering (no effect round trip):
  // the previous snapshot, the alert, and a counter that bumps once per lost lead.
  const [track, setTrack] = useState<{ snap: BidSnapshot | null; alert: OutbidAlert | null; fired: number }>({
    snap: null,
    alert: null,
    fired: 0,
  })
  const snap = snapshotOf(state)
  if (snap && !sameSnapshot(track.snap, snap)) {
    const change = outbidChange(track.snap, snap, myTeamId, !!track.alert)
    let { alert, fired } = track
    if (change?.type === 'outbid') {
      alert = { byTeam: change.byTeam, amount: change.amount }
      fired += 1
    } else if (change?.type === 'raised') {
      alert = { byTeam: change.byTeam, amount: change.amount }
    } else if (change?.type === 'clear') {
      alert = null
    }
    setTrack({ snap, alert, fired })
  }

  // The alarm itself — once per lost lead.
  useEffect(() => {
    if (track.fired === 0) return
    try {
      navigator.vibrate?.([180, 90, 180])
    } catch {
      // not supported
    }
    if (soundOn) beep()
    if (document.hidden) {
      const original = document.title
      document.title = `⚠ ${titleText}`
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
    // Only a new lost lead re-runs this; a changed title text or mute choice must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.fired])

  return myTeamId ? track.alert : null
}
