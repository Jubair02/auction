// Bangladeshi mobile numbers. Accepts the forms people actually type —
// 01712345678, 01712-345678, +8801712345678, 8801712345678 — and stores one
// canonical local form (01XXXXXXXXX). SMS gateways want the 880 form.

const LOCAL_RE = /^01[3-9]\d{8}$/

/** Canonical 11-digit local form (01XXXXXXXXX), or null if it isn't a BD mobile number. */
export function normalizeBdPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('880')) digits = '0' + digits.slice(3)
  return LOCAL_RE.test(digits) ? digits : null
}

/** International form without '+', e.g. 8801712345678 — what BD SMS gateways expect. */
export function toSmsNumber(input: string): string | null {
  const local = normalizeBdPhone(input)
  return local ? '88' + local : null
}
