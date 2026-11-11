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
