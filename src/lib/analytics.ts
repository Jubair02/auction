// First-party product analytics: one row per business event, written server-side.
// No cookies, no third-party trackers, no personal data in props.
// Server-only (uses the database).
import { db } from '@/lib/db'

export type AnalyticsEventName =
  | 'signup'
  | 'login'
  | 'tournament_created'
  | 'auction_created'
  | 'auction_started'
  | 'auction_completed'
  | 'player_registered'
  | 'payment_submitted'
  | 'pro_activated'
  | 'results_shared'
  | 'sms_reminder_sent'
  | 'account_deleted'
  | 'data_exported'

/** Records an event. Never throws: analytics must not break the request it measures. */
export async function track(
  name: AnalyticsEventName,
  opts: { userId?: string | null; tournamentId?: string | null; props?: Record<string, string | number | boolean | null> } = {},
): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        name,
        userId: opts.userId ?? null,
        tournamentId: opts.tournamentId ?? null,
        props: opts.props ?? undefined,
      },
    })
  } catch (err) {
    console.error('[analytics] track failed:', name, (err as Error).message)
  }
}
