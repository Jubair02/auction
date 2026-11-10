// Live-room notices as codes + values, rendered in English or Bangla.
//
// The auction service sends each notice with a `code` and its `params` (names,
// amounts) next to an English `message`. The room renders the code in the
// viewer's language; an unknown code (an older or newer service) falls back
// to `message`. Both sides import this one table, so the English the service
// sends is exactly what an English room shows.
//
// No runtime imports: the auction service (Bun) and the unit tests (node
// --test) load this file directly.

export type RoomLang = 'en' | 'bn'
export type RoomMsgParams = Record<string, string | number>

const EN_IN = new Intl.NumberFormat('en-IN')
const tk = (n: string | number | undefined) => `৳${EN_IN.format(Number(n) || 0)}`
const s = (v: string | number | undefined) => (v === undefined ? '' : String(v))
const plural = (n: string | number | undefined, one: string, many: string) => (Number(n) === 1 ? one : many)

type Render = (p: RoomMsgParams) => string

const TABLE = {
  bid: {
    en: (p) => `${s(p.team)} bids ${tk(p.amount)} for ${s(p.player)}`,
    bn: (p) => `${s(p.player)}-এর জন্য ${s(p.team)}-এর বিড ${tk(p.amount)}`,
  },
  manual_bid: {
    en: (p) => `Manual bid by ${s(p.by) || 'the organizer'}: ${s(p.team)} → ${tk(p.amount)}`,
    bn: (p) => `${s(p.by) || 'আয়োজক'}-এর দেওয়া ম্যানুয়াল বিড: ${s(p.team)} → ${tk(p.amount)}`,
  },
  started: { en: () => 'Auction started! Good luck everyone.', bn: () => 'নিলাম শুরু! সবার জন্য শুভকামনা।' },
  paused: { en: () => 'Auction paused', bn: () => 'নিলাম বিরতিতে' },
  auto_paused: {
    en: (p) =>
      `Auction paused automatically — no organizer or team manager was connected for ${s(p.seconds)} seconds. The organizer can resume it.`,
    bn: (p) => `নিলাম নিজে থেকে বিরতিতে গেছে — ${s(p.seconds)} সেকেন্ড ধরে কোনো আয়োজক বা টিম ম্যানেজার যুক্ত ছিলেন না। আয়োজক আবার চালু করতে পারেন।`,
  },
  resumed: { en: () => 'Auction resumed', bn: () => 'নিলাম আবার শুরু' },
  category_selected: {
    en: (p) => `Category ${s(p.category)} selected`,
    bn: (p) => `ক্যাটাগরি ${s(p.category)} বেছে নেওয়া হয়েছে`,
  },
  skipped: {
    en: (p) => `${s(p.player)} is skipped by the organizer`,
    bn: (p) => `আয়োজক ${s(p.player)}-কে বাদ দিয়ে এগিয়েছেন`,
  },
  reauction: {
    en: (p) =>
      `${s(p.player)} goes back under the hammer (round ${s(p.round)}) — ${tk(p.refund)} refunded to ${s(p.team) || 'the previous team'}. Bidding restarts at ${tk(p.base)}.` +
      (p.blocked ? ` ${s(p.team) || 'The previous team'} cannot bid in this round.` : ''),
    bn: (p) =>
      `${s(p.player)} আবার নিলামে (রাউন্ড ${s(p.round)}) — ${s(p.team) || 'আগের দল'} ${tk(p.refund)} ফেরত পেয়েছে। বিড আবার শুরু ${tk(p.base)} থেকে।` +
      (p.blocked ? ` ${s(p.team) || 'আগের দল'} এই রাউন্ডে বিড করতে পারবে না।` : ''),
  },
  ended: { en: () => 'Auction ended. Final squads are ready!', bn: () => 'নিলাম শেষ। চূড়ান্ত স্কোয়াড তৈরি!' },
  reopened: {
    en: (p) =>
      p.auto ? 'Auction reopened — Auto Auction brings the next player up shortly.' : 'Auction reopened — bring the next player to the block.',
    bn: (p) =>
      p.auto ? 'নিলাম আবার খোলা হয়েছে — অটো নিলাম শিগগিরই পরের খেলোয়াড় তুলবে।' : 'নিলাম আবার খোলা হয়েছে — পরের খেলোয়াড়কে নিলামে তুলুন।',
  },
  round_complete: {
    en: (p) =>
      `Round ${s(p.round)} complete — re-auction the ${s(p.left)} unsold & skipped ${plural(p.left, 'player', 'players')}, or finalize the auction.`,
    bn: (p) => `রাউন্ড ${s(p.round)} শেষ — অবিক্রিত ও বাদ পড়া ${s(p.left)} জন খেলোয়াড়কে আবার নিলামে তুলুন, অথবা নিলাম চূড়ান্ত করুন।`,
  },
  round_all_sold: {
    en: (p) => `Round ${s(p.round)} complete — every player has been sold. Finalize the auction when ready.`,
    bn: (p) => `রাউন্ড ${s(p.round)} শেষ — সব খেলোয়াড় বিক্রি হয়েছেন। প্রস্তুত হলে নিলাম চূড়ান্ত করুন।`,
  },
  category_next: {
    en: (p) => `Category complete — moving on to Category ${s(p.category)}`,
    bn: (p) => `ক্যাটাগরি শেষ — এবার ক্যাটাগরি ${s(p.category)}`,
  },
  no_categorised_left: {
    en: () => 'No categorised players left — end the auction or pick from the pool.',
    bn: () => 'ক্যাটাগরিভুক্ত আর কোনো খেলোয়াড় নেই — নিলাম শেষ করুন বা পুল থেকে বেছে নিন।',
  },
  uncategorised_now: {
    en: () => 'Auctioning players that have no category set',
    bn: () => 'এখন ক্যাটাগরি ছাড়া খেলোয়াড়দের নিলাম চলছে',
  },
  on_block: {
    en: (p) => `Player #${s(p.number)} — ${s(p.player)} is on the block!`,
    bn: (p) => `খেলোয়াড় #${s(p.number)} — ${s(p.player)} এখন নিলামে!`,
  },
  sold: {
    en: (p) => `${s(p.player)} SOLD to ${s(p.team)} for ${tk(p.amount)}!`,
    bn: (p) => `${s(p.player)} বিক্রি — ${s(p.team)} কিনল ${tk(p.amount)}-এ!`,
  },
  unsold: { en: (p) => `${s(p.player)} goes UNSOLD`, bn: (p) => `${s(p.player)} অবিক্রিত রইলেন` },
  round_started: {
    en: (p) =>
      `Round ${s(p.round)} started — ${s(p.count)} unsold & skipped ${plural(p.count, 'player is', 'players are')} back under the hammer.`,
    bn: (p) => `রাউন্ড ${s(p.round)} শুরু — অবিক্রিত ও বাদ পড়া ${s(p.count)} জন খেলোয়াড় আবার নিলামে।`,
  },
  auto_nothing_left: {
    en: () => 'Auto Auction: no players left to bring up.',
    bn: () => 'অটো নিলাম: তোলার মতো আর কোনো খেলোয়াড় নেই।',
  },
  auto_on_next: {
    en: () => 'Auto Auction ON — the next player comes up automatically after this one.',
    bn: () => 'অটো নিলাম চালু — এই খেলোয়াড়ের পর পরেরজন নিজে থেকেই আসবেন।',
  },
  auto_on: { en: () => 'Auto Auction ON', bn: () => 'অটো নিলাম চালু' },
  auto_off: {
    en: () => 'Auto Auction OFF — use Next player to bring up each player.',
    bn: () => 'অটো নিলাম বন্ধ — প্রতিটি খেলোয়াড় তুলতে “পরের খেলোয়াড়” চাপুন।',
  },
  timer_set_next: {
    en: (p) => `Bidding duration set to ${s(p.seconds)}s — applies from the next player.`,
    bn: (p) => `বিডের সময় ${s(p.seconds)} সেকেন্ড করা হয়েছে — পরের খেলোয়াড় থেকে কার্যকর।`,
  },
  timer_set: {
    en: (p) => `Bidding duration set to ${s(p.seconds)}s.`,
    bn: (p) => `বিডের সময় ${s(p.seconds)} সেকেন্ড করা হয়েছে।`,
  },
  going_once: { en: () => 'GOING ONCE!', bn: () => 'গোয়িং ওয়ান্স!' },
  going_twice: { en: () => 'GOING TWICE!', bn: () => 'গোয়িং টোয়াইস!' },
} satisfies Record<string, Record<RoomLang, Render>>

export type RoomMsgCode = keyof typeof TABLE

export interface RoomMsg {
  code: RoomMsgCode
  params?: RoomMsgParams
}

export const ROOM_MSG_CODES = Object.keys(TABLE) as RoomMsgCode[]

/** A notice in `lang`. */
export function roomText(msg: RoomMsg, lang: RoomLang): string {
  return TABLE[msg.code][lang](msg.params ?? {})
}

/**
 * The text to show for a received notice: its code rendered in `lang`, or the
 * English `message` it carried when the code is unknown or absent.
 */
export function roomNoticeText(n: { code?: string; params?: RoomMsgParams; message: string }, lang: RoomLang): string {
  if (!n.code || !Object.hasOwn(TABLE, n.code)) return n.message
  try {
    return roomText({ code: n.code as RoomMsgCode, params: n.params }, lang)
  } catch {
    return n.message
  }
}
