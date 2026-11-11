# Deploying NeelamGhor

The app is **two programs** that must both run in production:

| Part | What it is | Where it can run |
|---|---|---|
| **Website + API** | Next.js (`src/`) | Vercel (configured: region `sin1`, next to the Neon database) |
| **Live auction service** | Socket.IO server (`mini-services/auction-service`) | Any host that keeps a long-running process: Render, Railway, Fly.io, a VPS. **Not Vercel** — serverless functions can't hold WebSocket connections or run the auction timers. |

If the auction service isn't running, or the two parts aren't pointed at each other, every auction room stays on "Connecting to the auction floor…".

## Environment variables

| Variable | Website (Vercel) | Auction service | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | Same Neon **pooled** URL on both, with `?sslmode=require&connect_timeout=15&pool_timeout=20&pgbouncer=true` |
| `DIRECT_URL` | optional | — | Direct (non-pooled) URL used only for migrations. If unset, `npm run db:deploy` derives it from a Neon `DATABASE_URL` by dropping `-pooler`. Migrations through the pooler can leave Prisma's advisory lock stuck (P1002 timeouts). |
| `AUCTION_SECRET` | ✅ | ✅ | **Exactly the same value on both** (≥ 32 random chars, `openssl rand -base64 48`). Different values = every room join fails. |
| `NEXT_PUBLIC_AUCTION_URL` | ✅ | — | Public URL of the auction service, e.g. `https://neelamghor-live.onrender.com`. Baked in at build time — **redeploy** after changing it. |
| `ALLOWED_ORIGINS` | — | ✅ | Your website's origin(s), comma-separated, e.g. `https://neelamghor.vercel.app,https://neelamghor.com`. Without it browsers are refused. |
| `NODE_ENV` | (set by Vercel) | `production` | |
| `APP_URL` | ✅ | — | Public site URL used in password-reset emails and the room link in SMS reminders, e.g. `https://neelamghor.com` |
| `SMS_DRIVER`, `SMS_ENABLED`, `SMS_HTTP_*` | — | ✅ | SMS delivery — see "SMS notifications" below |
| `RESEND_API_KEY`, `RESEND_FROM` | ✅ | — | Password-reset email (verify your domain in Resend first) |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | optional | — | `1` shows the demo organizer/manager logins on the sign-in page. Only for a public demo site — **never on a real deployment**. Build-time, like every `NEXT_PUBLIC_` variable. |
| `PRODUCTION_DATABASE_URL` | optional | — | Set it (all environments) to the production `DATABASE_URL`: a Preview build that was given the same URL then prints a loud warning. |
| `ALLOW_DB_RESET`, `SEED_ADMIN_PASSWORD` | — | — | Local only, for `bun prisma/seed.ts` / `npm run db:reset` — see "Separate databases per environment". |
| `ALERT_WEBHOOK_URL` | recommended | recommended | Incoming-webhook URL (Slack, Discord, …) that receives an alert for every server error, browser crash and auction-engine failure — see "Monitoring". |
| `AUCTION_DB_POOL_SIZE` | — | optional | Database connections the auction service keeps for rooms (default `10`; the SMS worker has its own 2). Ignored if `DATABASE_URL` already sets `connection_limit`. |
| `SMS_DAILY_LIMIT_*` | — | optional | SMS spending caps — see "SMS notifications". |
| `AUCTION_LEASE_NAME` | — | tests only | Lets a test run a second auction service against the same database on purpose. Never set it in production. |

All of these are **per environment**: production, Preview and your local `.env` each get their own `DATABASE_URL` and their own `AUCTION_SECRET` (the website and the auction service *of the same environment* share one).

## Website (Vercel)

- **Build Command: leave it at the default.** Vercel then runs `npm run vercel-build`: it builds first, then applies database migrations over a direct connection — for production deployments, and for preview deployments only when `PRODUCTION_DATABASE_URL` is set and differs from the preview's `DATABASE_URL` (proof that it is not production). A failed build never touches the database; a failed migration fails the deployment and the previous version stays live.
- **Migrations must be backward compatible.** The previous deployment keeps serving for a moment after the migration runs, so add columns/tables/indexes first and only drop or rename them in a later release (expand, then contract).
- **Install:** npm (`package-lock.json` is the only lockfile).
- **Sessions:** logins are stored server-side (`Session` table); logging out revokes that session. Deploying this version signs everyone out once.
- **Preview deployments must use their own database** — see the next section. Never give the Preview environment the production `DATABASE_URL`.
- **Uploads:** Vercel rejects request bodies over 4.5 MB, so images are capped at 4 MB; the browser shrinks big phone photos (max 1600 px, ~85 % quality) before uploading.
- Uploaded images are served with `CDN-Cache-Control: immutable`, so Vercel's CDN answers repeat views without touching the database.

## Separate databases per environment (mandatory)

| Environment | Database | `AUCTION_SECRET` |
|---|---|---|
| Production | the Neon project's **main** branch | its own value |
| Preview (every branch / pull request) | a **separate Neon branch** — Neon's Vercel integration can create one per preview deployment automatically; otherwise one shared `preview` branch | a different value |
| Local development | its own Neon branch (or a local Postgres) | a different value |

Why: a preview build runs unmerged code against whatever `DATABASE_URL` it is given, and testing on a preview creates, edits and deletes real rows. A shared secret would also let a session cookie from one environment log in to another.

- In Vercel → Settings → Environment Variables, set `DATABASE_URL` (and `DIRECT_URL` if used) **separately** for Production and for Preview / Development. Set `PRODUCTION_DATABASE_URL` too as a tripwire (see the table above).
- Migrations run automatically for production deployments, and for previews once `PRODUCTION_DATABASE_URL` is set (so a pull request with a new migration works on its preview). Without it, run `npm run db:deploy` yourself with `DATABASE_URL` pointing at the preview branch.
- **Destructive scripts refuse to run unless you opt in.** `bun prisma/seed.ts` (wipes all users and tournaments, then loads demo data) and `npm run db:reset` (drops every table) exit immediately unless `ALLOW_DB_RESET=1` is set, and always refuse when `NODE_ENV` or `VERCEL_ENV` is `production`. Double-check which database your `.env` points at before setting it:
  ```bash
  ALLOW_DB_RESET=1 bun prisma/seed.ts          # PowerShell: $env:ALLOW_DB_RESET=1; bun prisma/seed.ts
  ```
  The seeded admin (`admin@neelamghor.bd`) gets `SEED_ADMIN_PASSWORD` if set, otherwise a random password printed once at the end of the run. The auction service's smoke test drives the seeded demo room, so it belongs on the same non-production database.

## Auction service (e.g. Render, "Web Service")

- **Root directory:** repository root
- **Build command:** `npm ci --include=dev && npx prisma generate` (Bun is a dev dependency; `--include=dev` keeps it when `NODE_ENV=production`)
- **Start command:** `npx bun mini-services/auction-service/index.ts`
- **Port:** the service listens on `PORT` (set by the host) or 3003.
- Region: Singapore, next to the database.
- **Exactly ONE instance, always.** Live auction state (timers, the current lot, who is bidding) lives in this one process's memory. Two instances = two independent auctioneers for the same room: double sales, timers that fight, budgets spent twice.
  - On Render: instance count **1**, **autoscaling off**.
  - Only one instance ever **serves rooms**: the old one has to be gone before the new one takes over. Render's normal zero-downtime deploy works (see standby below). A redeploy during a live auction disconnects everyone for a moment; clients reconnect and resync — prefer deploying between auctions.
  - **Enforced by a lease.** An instance serves rooms only while it holds the `auction-engine` row in the `ServiceLease` table, renewed every 5 s. A clean shutdown releases it at once; a crash lets it expire within 30 s. If an instance ever finds that another one has taken its lease, it stops itself and alerts.
  - **Standby.** A new instance opens its port at once, so the host sees it come up, but while another instance holds the lease it stays in **standby**: it logs `another instance holds the engine lease … Waiting`, `/healthz` answers `200` with `"standby": true`, every connection is refused with "restarting — try again" (clients retry), and it loads no rooms and runs no timers. It doesn't run the SMS outbox or the retention sweep either; they start only once it holds the lease. On Render, a deploy therefore goes: new instance up in standby → Render stops the old one → lease released → the new one takes over within ~3 s. (Before standby, the new instance waited with its port closed and Render failed every deploy while the old one was running.)
  - **Production always wins over a developer's copy.** A deployed instance (`NODE_ENV=production`, or running on Render / Railway / Fly) takes the lease over at once from a local `npm run dev` that is using the production database by mistake; the local copy then stops with a message saying so, and never takes it back. Without this, a laptop left running against production kept the real service waiting forever — it never opened its port and the host failed the deploy. (Two production instances still never overlap.) The real fix is the next point: local development must not use the production database.
  - **Graceful stop.** On `SIGTERM` the service refuses new joins, bids and actions, lets everything already in progress finish (up to 8 s, so a committed sale also reaches everyone), marks everyone offline, releases the lease and exits. Give the host a shutdown grace period of at least 15 s; on Render the default is 30 s.
  - **Empty rooms hold, then pause themselves.** The moment no organizer and no team manager is connected to a LIVE auction, the lot clock and Auto Auction stop. If someone is back within 30 s, the lot carries on with the time it had; otherwise the auction pauses (keeping that time) and the organizer resumes it. A phone that silently loses Wi-Fi counts as gone after at most ~30 s (socket ping every 10 s, 20 s timeout).
  - **Deleted tournaments are closed in the live room too.** Deleting a tournament with auction history archives it; its room then refuses joins, open organizer and manager seats are ended at their next check (within 5 s), and it can't be started or reopened from a seat pass issued earlier.
  - Fly.io: one machine (`fly scale count 1`); Railway: 1 replica.
- **Always-on paid plan.** Free instances sleep after ~15 minutes without traffic and take 30–60 s to wake — the first visitors to a room see "Connecting…" and timers stall. Use a paid instance that never sleeps.

## SMS notifications

Pro tournaments can text players and managers (registration decisions, an auction reminder the organizer sends, and "you were sold"). Organizers switch it on per tournament under **Auction → SMS notifications**.

How it works: the website and the auction engine only **queue** messages in the `Notification` table (the outbox). The **worker that sends them runs inside the auction service** (`mini-services/auction-service/outbox.ts`), every ~10 s: it claims up to 20 due rows atomically, sends them, and marks each `SENT`, or retries with backoff (1 min, 5 min, 15 min, 1 h) and marks it `FAILED` after 5 attempts. Admins see the queue — numbers masked to the last 3 digits — and can retry failed messages under **Admin → SMS outbox**. If the auction service is down, messages simply wait in the queue.

The same worker runs an **hourly retention sweep** (deletes rejected registrations after 90 days, SMS log after 180 days, unused uploaded images after 7 days, expired rate-limit counters, and expired/revoked sessions after 30 days) and logs the counts as `[maintenance] deleted …`.

Environment variables (auction service only):

| Variable | Default | Meaning |
|---|---|---|
| `SMS_DRIVER` | `log` | `log` — prints a redacted line (`[sms:log] to ••••••••••678 …`) instead of sending; use it until you have a gateway account. `http` — sends through the gateway below. |
| `SMS_ENABLED` | on | `0` → nothing is sent; due messages are marked `SKIPPED` (a kill switch). |
| `SMS_HTTP_URL` | — | Gateway endpoint. May contain `{to}` (880… form), `{to_local}` (01… form) and `{body}`; they are URL-encoded here. Keep API keys here or in headers — never commit them. |
| `SMS_HTTP_METHOD` | `POST` if a body is set, else `GET` | `GET` or `POST`. |
| `SMS_HTTP_BODY` | — | POST body template with the same placeholders. Escaped as JSON when the content type is JSON (a template starting with `{` defaults to `application/json`), URL-encoded otherwise. |
| `SMS_HTTP_HEADERS` | — | JSON object of extra headers, e.g. `{"Authorization":"Bearer …"}`. |
| `SMS_HTTP_SUCCESS` | — | Optional regex the response text must match. Many BD gateways answer HTTP 200 even on errors and put the result code in the body. |
| `SMS_LOG_BODY` | — | `1` makes the log driver print message text in production too (it does outside production). |
| `SMS_DAILY_LIMIT_PER_NUMBER` | `5` | At most this many texts to one phone number per 24 h. Stops anyone using the public registration form to flood a stranger's phone. |
| `SMS_DAILY_LIMIT_PER_TOURNAMENT` | `500` | At most this many texts for one tournament per 24 h. |
| `SMS_DAILY_LIMIT_TOTAL` | `5000` | Platform-wide ceiling per 24 h — your worst-case daily SMS bill. |

Messages over a limit are marked `SKIPPED` with the reason (visible under **Admin → SMS outbox**). Texts never contain anything a player typed into the public registration form (not even their name), so the form can't be used to send our SMS with someone else's words in it.

**Example (illustrative only — check your gateway's current API docs for the exact URL, parameter names and success code).** A typical Bangladeshi gateway with a GET API:

```bash
SMS_DRIVER=http
SMS_HTTP_URL="https://sms-gateway.example.com.bd/api/send?api_key=YOUR_KEY&senderid=YOUR_SENDER_ID&number={to}&message={body}"
SMS_HTTP_SUCCESS='"response_code"\s*:\s*202'
```

or one with a JSON POST API:

```bash
SMS_DRIVER=http
SMS_HTTP_URL=https://sms-gateway.example.com.bd/api/v3/send-sms
SMS_HTTP_BODY='{"api_token":"YOUR_TOKEN","sid":"YOUR_SID","msisdn":"{to}","sms":"{body}","csms_id":"ng"}'
SMS_HTTP_HEADERS='{"Accept":"application/json"}'
```

Notes: messages are Bangla by default (Unicode SMS, ~70 characters per part — a message is usually 2–3 parts; organizers can switch a tournament to English). BTRC rules require a registered sender ID / masking with most gateways. Restart the auction service after changing these variables. The startup log line `[outbox] SMS worker started — driver=…` shows which driver is active.

## Monitoring

Set up an external uptime monitor — e.g. [UptimeRobot](https://uptimerobot.com) or [Better Stack](https://betterstack.com/uptime) (both have free tiers) — with **two HTTP checks**, every 1–5 minutes:

| Check | URL | Healthy |
|---|---|---|
| Website + database | `https://<your-site>/api/health` | HTTP 200 (`503` = the database is unreachable) |
| Auction service | `https://<auction-host>/healthz` | HTTP 200 (`503` = the service is up but unhealthy, e.g. cannot reach the database) |

- Alert by **email and SMS / push** (the monitors' mobile apps work) to at least two people — on auction days somebody must see it within minutes.
- Both endpoints are cheap (one `SELECT 1`), uncached and safe to poll.
- Uptime monitors only see "up or down". For **errors**, set `ALERT_WEBHOOK_URL` on both the website and the auction service:
  - Slack: *Apps → Incoming Webhooks* → copy the URL. Discord: *Channel settings → Integrations → Webhooks* → copy the URL. Point it at a channel the people running auctions watch.
  - What is reported: every uncaught error in an API route or page render (`src/instrumentation.ts`), crashes in the browser caught by the app's error screens (`/api/client-errors`), and auction-engine failures — a sale or bid the database refused, a lot that failed to close, an unexpected exception, the service stopping because another instance took over.
  - Each report is also one JSON log line (`"level":"error"`) in the Vercel / Render logs. The same error is sent to the webhook at most once per 10 minutes, and at most 30 alerts per hour per instance, so a bad day can't flood the channel.
  - Test it: open `https://<your-site>/api/client-errors` with a tool that can POST `{"message":"test alert"}` — an alert should arrive.

## Backups & restore

**1. Neon point-in-time restore (PITR).** Neon keeps a history of every change and can restore — or branch — the database as of any moment inside the *restore window*. The window depends on your Neon plan (short on the free plan, longer on paid plans): **check it in the Neon console → Settings and write it down here.** Restoring: Neon console → Branches → *Restore* (or create a branch at a timestamp, check it, then switch to it).

**2. Nightly logical backup (independent of Neon).** PITR does not help if the Neon project itself is deleted or the window has passed. Once a night, and before every risky migration:

```bash
npm run db:backup     # → backups/neelamghor-<timestamp>.dump
```

- Uses `pg_dump --format=custom` over the **direct** URL (`DIRECT_URL`, or `DATABASE_URL` with `-pooler` dropped — `pg_dump` does not work through PgBouncer). Needs the PostgreSQL client tools (`pg_dump`) at the same or a newer major version than the server.
- `backups/` is git-ignored. **Copy each dump off the machine** (cloud storage with versioning). The files contain personal data (names, phone numbers, emails) — keep them private.
- **Automated:** `.github/workflows/backup.yml` runs every night at 03:30 Dhaka time (and on demand: *Actions → Database backup → Run workflow*). It dumps the database, encrypts the file with AES-256 and keeps it as a workflow artifact for 14 days. Set it up once under *Settings → Secrets and variables → Actions*:
  - `BACKUP_DATABASE_URL` — the production **direct** URL (no `-pooler`).
  - `BACKUP_PASSPHRASE` — a long random passphrase. **Also store it in your password manager**: without it the backups can't be opened.
  - GitHub emails you when a scheduled run fails. Check the *Actions* tab after the first night.
  - To restore one, download the artifact (*Actions → the run → Artifacts*), unzip it, then decrypt it: `gpg --decrypt neelamghor-<timestamp>.dump.gpg > neelamghor-<timestamp>.dump`.
  - Artifacts count against the GitHub storage quota of a private repository, and image uploads live in the database, so watch the size. For longer retention, copy dumps to versioned cloud storage as well.

**3. Restore drill — do it once now, then every few months.** A backup that has never been restored is a hope, not a backup.

1. In Neon create an **empty** branch (or a new project) — never restore over production directly.
2. Restore the latest dump into it, using its direct URL:
   ```bash
   pg_restore --no-owner --no-privileges --dbname "<direct url of the empty branch>" backups/neelamghor-<timestamp>.dump
   ```
3. Point a local checkout at that branch and run `npm run db:deploy` (it should have nothing to apply), then `npm run dev`; log in and open a recent tournament's results and audit trail.
4. Write down how long it took. In a real incident: restore into a fresh branch like this, verify it, then switch the production `DATABASE_URL` on Vercel **and** on the auction service to it and redeploy both.

## Checking the setup

1. Open `https://<your-site>/api/health` → `{"status":"ok","secret":"<8 chars>"}`, and `https://<auction-host>/healthz` → HTTP 200.
2. The auction service logs `AUCTION_SECRET fingerprint: <8 chars>` on start — **must match** the value from step 1.
3. The service log should also print `allowed browser origins: …` including your site. A `WARNING: ALLOWED_ORIGINS is not set` line means browsers will be refused.
4. Open an auction room. If it stays on "Connecting…", check the browser console: a `NEXT_PUBLIC_AUCTION_URL is not set` warning means the website was built without it.
