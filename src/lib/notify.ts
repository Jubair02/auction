// SMS notifications go through an outbox (the Notification table): routes only
// enqueue rows; the always-on auction service delivers them (see
// mini-services/auction-service/outbox.ts). Server-only (uses the database).
import { db } from '@/lib/db'
import { toSmsNumber } from '@/lib/phone'

export interface EnqueueSmsInput {
  to: string
  body: string
  kind: string
  tournamentId?: string | null
  /** Same key twice → the second is ignored (e.g. `reg-approved:<registrationId>`). */
  dedupeKey?: string | null
  sendAfter?: Date
}

/** Queues one SMS. Never throws; invalid numbers are skipped. Returns true if queued. */
export async function enqueueSms(input: EnqueueSmsInput): Promise<boolean> {
  const to = toSmsNumber(input.to)
  if (!to) return false
  try {
    await db.notification.create({
      data: {
        channel: 'SMS',
        to,
        body: input.body.slice(0, 480),
        kind: input.kind,
        tournamentId: input.tournamentId ?? null,
        dedupeKey: input.dedupeKey ?? null,
        sendAfter: input.sendAfter ?? new Date(),
      },
    })
    return true
  } catch (err) {
    // P2002 on dedupeKey = already queued, which is fine.
    if ((err as { code?: string }).code !== 'P2002') console.error('[notify] enqueue failed:', (err as Error).message)
    return false
  }
}

/** Tournament fields that decide whether / how to text people about it. */
export interface NotifyTournament {
  id: string
  name: string
  plan: string
  smsEnabled: boolean
  smsLang: string
}

export const smsAllowed = (t: NotifyTournament) => t.plan === 'PRO' && t.smsEnabled

/** "8801712345678" → "••••••••••678" — the only form numbers are shown in logs and the admin outbox. */
export function maskNumber(to: string): string {
  const digits = to.replace(/\D/g, '')
  return digits.length <= 3 ? '•••' : '•'.repeat(digits.length - 3) + digits.slice(-3)
}

/** Day key in Bangladesh time (YYYY-MM-DD), for "once per recipient per day" dedupe keys. */
export function dhakaDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

/** The auction reminder text, in the tournament's SMS language. */
export function auctionReminderBody(
  tournament: Pick<NotifyTournament, 'name' | 'smsLang'>,
  auctionAt: Date | null,
  roomLink: string,
): string {
  const bn = tournament.smsLang !== 'en'
  // A time already in the past is left out rather than printed wrong.
  const when =
    auctionAt && auctionAt.getTime() > Date.now()
      ? new Intl.DateTimeFormat(bn ? 'bn-BD-u-nu-latn' : 'en-GB', {
          timeZone: 'Asia/Dhaka',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(auctionAt)
      : null
  if (bn) {
    return when
      ? `মনে করিয়ে দিচ্ছি: ${tournament.name} নিলাম শুরু ${when}-এ। লাইভ দেখুন: ${roomLink} — NeelamGhor`
      : `মনে করিয়ে দিচ্ছি: ${tournament.name} নিলাম শিগগিরই শুরু হচ্ছে। লাইভ দেখুন: ${roomLink} — NeelamGhor`
  }
  return when
    ? `Reminder: the ${tournament.name} auction starts ${when}. Watch live: ${roomLink} — NeelamGhor`
    : `Reminder: the ${tournament.name} auction starts soon. Watch live: ${roomLink} — NeelamGhor`
}

/** Texts a player that their registration was approved or rejected (if the tournament has SMS on). */
export async function notifyRegistrationDecision(
  tournament: NotifyTournament,
  reg: { id: string; name: string; phone: string; smsConsent: boolean },
  decision: 'APPROVED' | 'REJECTED',
): Promise<void> {
  if (!smsAllowed(tournament) || !reg.smsConsent) return
  const bn = tournament.smsLang !== 'en'
  const body =
    decision === 'APPROVED'
      ? bn
        ? `${reg.name}, ${tournament.name}-এ আপনার নিবন্ধন অনুমোদিত হয়েছে। নিলামে শুভকামনা! — NeelamGhor`
        : `${reg.name}, your registration for ${tournament.name} is approved. Good luck at the auction! — NeelamGhor`
      : bn
        ? `${reg.name}, ${tournament.name}-এ আপনার নিবন্ধন এবার গ্রহণ করা হয়নি। — NeelamGhor`
        : `${reg.name}, your registration for ${tournament.name} was not accepted this time. — NeelamGhor`
  await enqueueSms({
    to: reg.phone,
    body,
    kind: decision === 'APPROVED' ? 'REG_APPROVED' : 'REG_REJECTED',
    tournamentId: tournament.id,
    dedupeKey: `reg-${decision.toLowerCase()}:${reg.id}`,
  })
}
