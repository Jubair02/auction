// The site's support number: ONE value, the `supportPhone` row in the Setting
// table. Admins edit it in Admin → Settings or in their Edit profile dialog
// (both through the same rules below); everyone sees it via GET /api/settings
// (footer call / WhatsApp links, Terms, Privacy notice). It is not any user's
// personal phone — those live on the User row and are never shown here.

export const SUPPORT_PHONE_KEY = 'supportPhone'
export const SUPPORT_PHONE_MAX = 20

/**
 * '' clears it (the site then shows no support number). Otherwise a phone
 * number as people write it: a mobile (01712-345678, +8801712345678), a
 * landline or a short hotline (16xxx) — digits with optional +, spaces,
 * dashes and brackets, at least 5 digits.
 */
export function validateSupportPhone(raw: string): { value: string } | { error: string } {
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value === '') return { value: '' }
  const digits = value.replace(/\D/g, '').length
  if (value.length > SUPPORT_PHONE_MAX || !/^\+?[\d\s()-]+$/.test(value) || digits < 5) {
    return { error: 'Support number must be a phone number, e.g. 01712345678 or a hotline like 16XXX' }
  }
  return { value }
}

/** `tel:` link for a support number as shown. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** A Bangladeshi mobile number (01XXXXXXXXX, optionally +880) as wa.me digits, else null. */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('880') ? digits.slice(2) : digits
  return /^01[3-9]\d{8}$/.test(local) ? `88${local}` : null
}
