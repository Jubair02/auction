// Room seats saved in this tab (sessionStorage), split out of
// use-auction-socket so the app shell (logout in store.ts) can clear them
// without pulling socket.io-client into every page's first download.

/** Persisted room identity in sessionStorage (survives refresh within the tab). */
export interface StoredIdentity {
  role: 'ORGANIZER' | 'MANAGER' | 'VIEWER'
  name: string
  teamId?: string
  teamName?: string
  socketToken: string
  at: number
  /** Account the seat was issued to (null for an anonymous viewer). A seat is only reused by that account. */
  userId?: string | null
  /** Organizer seats: the holder's access level (auctioneers can't undo sales or reopen). */
  staff?: 'OWNER' | 'ADMIN' | 'CO_ORGANIZER' | 'AUCTIONEER' | null
}

export function saveRoomIdentity(roomCode: string, identity: StoredIdentity) {
  try {
    sessionStorage.setItem(`ng_room_${roomCode.toUpperCase()}`, JSON.stringify(identity))
  } catch {
    // ignore
  }
}

export function loadRoomIdentity(roomCode: string): StoredIdentity | null {
  try {
    const raw = sessionStorage.getItem(`ng_room_${roomCode.toUpperCase()}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredIdentity
    // tokens last 12h; drop stale ones
    if (Date.now() - parsed.at > 10 * 60 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

export function clearRoomIdentity(roomCode: string) {
  try {
    sessionStorage.removeItem(`ng_room_${roomCode.toUpperCase()}`)
  } catch {
    // ignore
  }
}

/** Drops every saved room seat in this tab — on logout, so the next person can't bid with them. */
export function clearAllRoomIdentities() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('ng_room_')) sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}
