// Next.js instrumentation: every uncaught error in a route handler, server
// render or server action goes through reportError (a JSON log line, plus an
// alert to ALERT_WEBHOOK_URL when set) — not only into the host's raw logs.
import type { Instrumentation } from 'next'
import { reportError } from '@/lib/report-error'

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportError(error, {
    source: 'web',
    // Path without the query string: links can carry codes we don't want in alerts.
    where: `${request.method} ${request.path.split('?')[0]}`,
    route: context.routePath,
    routeType: context.routeType,
  })
}
