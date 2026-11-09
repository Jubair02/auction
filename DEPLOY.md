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

All of these are **per environment**: production, Preview and your local `.env` each get their own `DATABASE_URL` and their own `AUCTION_SECRET` (the website and the auction service *of the same environment* share one).

## Website (Vercel)

- **Build Command: leave it at the default.** Vercel then runs `npm run vercel-build`, which applies database migrations **only for production deployments** (`VERCEL_ENV=production`), over a direct connection. Preview deployments never touch the database schema.
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
- Migrations run automatically only for production deployments. To try a new migration first, run `npm run db:deploy` with `DATABASE_URL` pointing at the preview branch.
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
  - Deploys must be **stop-then-start**, not zero-downtime / blue-green: the old instance has to be gone before the new one serves rooms. (A redeploy during a live auction disconnects everyone for a moment; clients reconnect and resync — prefer deploying between auctions.)
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
- Later: add error tracking such as [Sentry](https://sentry.io) (free tier) to the website and the auction service, so exceptions arrive with a stack trace instead of being found in host logs.

## Backups & restore

**1. Neon point-in-time restore (PITR).** Neon keeps a history of every change and can restore — or branch — the database as of any moment inside the *restore window*. The window depends on your Neon plan (short on the free plan, longer on paid plans): **check it in the Neon console → Settings and write it down here.** Restoring: Neon console → Branches → *Restore* (or create a branch at a timestamp, check it, then switch to it).

**2. Nightly logical backup (independent of Neon).** PITR does not help if the Neon project itself is deleted or the window has passed. Once a night, and before every risky migration:

```bash
npm run db:backup     # → backups/neelamghor-<timestamp>.dump
```

- Uses `pg_dump --format=custom` over the **direct** URL (`DIRECT_URL`, or `DATABASE_URL` with `-pooler` dropped — `pg_dump` does not work through PgBouncer). Needs the PostgreSQL client tools (`pg_dump`) at the same or a newer major version than the server.
- `backups/` is git-ignored. **Copy each dump off the machine** (cloud storage with versioning). The files contain personal data (names, phone numbers, emails) — keep them private.
- Automate it with a scheduled job (cron on a machine you control, or a scheduled GitHub Actions workflow with `DIRECT_URL` as a secret that uploads the dump to private storage). Keep at least 14 nightly copies.

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
