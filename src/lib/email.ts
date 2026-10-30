// Transactional email via Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
// Plain fetch — no SDK dependency. No Next.js imports, so it is unit-testable.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// Until a sending domain is verified in Resend, only onboarding@resend.dev
// works — and it only delivers to the Resend account owner's own address.
const DEFAULT_FROM = 'NeelamGhor <onboarding@resend.dev>'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export class EmailNotConfiguredError extends Error {}

/** Sends one email. Throws on any failure; the API key never appears in errors. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new EmailNotConfiguredError('RESEND_API_KEY is not set — cannot send email')

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { message?: string; name?: string }
      detail = body.message ?? body.name ?? ''
    } catch {
      // non-JSON error body
    }
    throw new Error(`Resend rejected the email (HTTP ${res.status})${detail ? `: ${detail}` : ''}`)
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Password reset email. `name` is user-supplied, so it is escaped. */
export function passwordResetEmail(opts: { name: string; link: string; ttlMinutes: number }): Omit<EmailMessage, 'to'> {
  const name = escapeHtml(opts.name.split(/\s+/)[0] || 'there')
  const link = escapeHtml(opts.link)
  return {
    subject: 'Reset your NeelamGhor password',
    text:
      `Hi ${opts.name.split(/\s+/)[0] || 'there'},\n\n` +
      `Someone asked to reset the password for your NeelamGhor account. Open this link to choose a new one:\n\n` +
      `${opts.link}\n\n` +
      `The link works once and expires in ${opts.ttlMinutes} minutes. If you did not ask for this, ignore this email — your password stays the same.\n\n` +
      `— NeelamGhor`,
    html: `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    <tr><td>
      <p style="margin:0 0 4px;font-size:13px;font-weight:bold;letter-spacing:.08em;color:#0f766e">NEELAMGHOR</p>
      <h1 style="margin:0 0 16px;font-size:20px">Reset your password</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hi ${name}, someone asked to reset the password for your NeelamGhor account.</p>
      <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Choose a new password</a></p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4b5563">The link works once and expires in ${opts.ttlMinutes} minutes.</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#4b5563">If you did not ask for this, ignore this email — your password stays the same.</p>
    </td></tr>
  </table>
</body></html>`,
  }
}
