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
| `APP_URL` | ✅ | — | Public site URL used in password-reset emails, e.g. `https://neelamghor.com` |
| `RESEND_API_KEY`, `RESEND_FROM` | ✅ | — | Password-reset email (verify your domain in Resend first) |

## Website (Vercel)

- **Build Command: leave it at the default.** Vercel then runs `npm run vercel-build`, which applies database migrations **only for production deployments** (`VERCEL_ENV=production`), over a direct connection. Preview deployments never touch the database schema.
- **Install:** npm (`package-lock.json` is the only lockfile).
- **Sessions:** logins are stored server-side (`Session` table); logging out revokes that session. Deploying this version signs everyone out once.
- Point preview deployments at a separate Neon branch database if you want previews to be fully usable.

## Auction service (e.g. Render, "Web Service")

- **Root directory:** repository root
- **Build command:** `npm ci --include=dev && npx prisma generate` (Bun is a dev dependency; `--include=dev` keeps it when `NODE_ENV=production`)
- **Start command:** `npx bun mini-services/auction-service/index.ts`
- **Port:** the service listens on `PORT` (set by the host) or 3003.
- Region: Singapore, next to the database.

## Checking the setup

1. Open `https://<your-site>/api/health` → `{"status":"ok","secret":"<8 chars>"}`.
2. The auction service logs `AUCTION_SECRET fingerprint: <8 chars>` on start — **must match** the value from step 1.
3. The service log should also print `allowed browser origins: …` including your site. A `WARNING: ALLOWED_ORIGINS is not set` line means browsers will be refused.
4. Open an auction room. If it stays on "Connecting…", check the browser console: a `NEXT_PUBLIC_AUCTION_URL is not set` warning means the website was built without it.
