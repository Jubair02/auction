// Organizer-written names (tournament, team) inside our SMS. Texts go out as
// "— NeelamGhor" to numbers the organizer uploaded, so a name must never be
// able to carry a scam: phone numbers, links, e-mail handles. What is left is
// the plain name, shortened. No imports: the auction service (Bun) and the
// unit tests (node --test) load this file directly.

const URL_LIKE = /\b(?:https?:\/\/|www\.)\S*/gi
// something.tld, e.g. "bit.ly", "win-now.com/x" (Latin letters only: Bangla words never match)
const DOMAIN_LIKE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b\S*/gi
// 5+ digits (Latin or Bangla), possibly split by spaces, dots, commas, dashes or brackets: phone numbers, codes, amounts.
const LONG_NUMBER = /\+?[0-9০-৯](?:[\s.,\-()/]*[0-9০-৯]){4,}/g

/** `name` made safe to print in an SMS, or `fallback` when nothing sensible is left. */
export function smsSafeName(name: string, fallback: string, max = 40): string {
  let s = (name ?? '')
    .replace(URL_LIKE, ' ')
    .replace(DOMAIN_LIKE, ' ')
    .replace(LONG_NUMBER, ' ')
    .replace(/[@<>{}[\]\\|^`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Leftover separators at the ends ("Tigers - " after a number was cut).
    .replace(/^[\s\-–—:;,.!?/+*#=_]+|[\s\-–—:;,/+*#=_]+$/g, '')
    .trim()
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`
  return /[\p{L}\p{N}]/u.test(s) ? s : fallback
}

/** The admin's review note as it goes into an SMS: one line, shortened. */
export function smsNote(note: string, max = 140): string {
  const s = note.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

/**
 * The organizer's SMS after an admin reviews their Pro payment. `name` must
 * already be smsSafeName()'d; the note is the admin's own text.
 */
export function paymentDecisionSms(input: { name: string; trxId: string; decision: 'APPROVED' | 'REJECTED'; note: string | null; bn: boolean }): string {
  const { name, trxId: trx, decision, bn } = input
  const reason = input.note ? smsNote(input.note) : null
  if (decision === 'APPROVED') {
    return bn
      ? `${name}-এর Pro পেমেন্ট (TrxID ${trx}) অনুমোদিত হয়েছে — Pro চালু হয়েছে।${reason ? ` নোট: ${reason}` : ''} — NeelamGhor`
      : `Your Pro payment for ${name} (TrxID ${trx}) is approved — Pro is now on.${reason ? ` Note: ${reason}` : ''} — NeelamGhor`
  }
  return bn
    ? `${name}-এর Pro পেমেন্ট (TrxID ${trx}) অনুমোদিত হয়নি।${reason ? ` কারণ: ${reason}` : ''} বিস্তারিত টুর্নামেন্টের পেজে দেখুন। — NeelamGhor`
    : `Your Pro payment for ${name} (TrxID ${trx}) was not approved.${reason ? ` Reason: ${reason}` : ''} See the details on your tournament page. — NeelamGhor`
}
