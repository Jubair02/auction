# Project Worklog — NeelamGhor (Player Auction Management Platform, Bangladesh MVP)

Product name: **NeelamGhor** (নিলামঘর = "auction house") — Live Player Auction platform for Bangladesh.
Single visible Next.js route `/` (SPA with hash routing). Socket.io mini service on port 3003 for the live auction room.

## Tech Stack
- Next.js 16 App Router + TypeScript, Tailwind 4, shadcn/ui (New York), lucide-react, framer-motion, sonner (toasts), zustand, Prisma + SQLite
- Live auction: socket.io mini-service `mini-services/auction-service` port 3003. Client connects with `io('/?XTransformPort=3003', { path: '/', transports: ['websocket','polling'] })`
- Auth: httpOnly cookie `ng_session` (HMAC-signed token), passwords scrypt-hashed. Socket tokens HMAC-signed with same secret (AUCTION_SECRET — required, ≥32 chars, no fallback; see .env.example). Manager (bidding) seats require a logged-in MANAGER account that owns or claims the team.

## Canonical Contract (source of truth: `src/lib/types.ts` + this doc)

### Roles
- `ADMIN` (platform admin), `ORGANIZER` (creates/runs auctions), `MANAGER` (team captain/manager, bids), `VIEWER` (watch-only, room-level role only)

### Core entities (Prisma, SQLite — NO enums, strings only)
- User {id, name, email unique, phone?, passwordHash, role: ADMIN|ORGANIZER|MANAGER, status: ACTIVE|BLOCKED}
- Tournament {id, name, sport: CRICKET|FOOTBALL, tournamentType?, description?, logoUrl?, bannerUrl?, location?, startDate?, auctionAt?, auctionMode: CATEGORY|NORMAL, basePrice (normal mode), status: DRAFT|READY|LIVE|COMPLETED, organizerId}
- Player {id, tournamentId, name, photoUrl?, phone?, role, category? (A–E), basePrice, previousTeam?, status: AVAILABLE|LIVE|SOLD|UNSOLD|SKIPPED, playerNumber, soldPrice?, soldToTeamId?}
- Team {id, tournamentId, name, logoUrl?, color? (hex), captainName?, managerUserId?, budget, maxSquad, minSquad, spent}
- Auction {id, tournamentId unique, roomCode unique (`BD26-XXXX`), status: READY|LIVE|PAUSED|ENDED, bidTimerSeconds, goingIntervalSeconds, minIncrement, currentCategory?, currentPlayerId?, currentBidAmount?, currentBidTeamId?, bidCount}
- Bid {id, auctionId, playerId, teamId, teamName, playerName, amount, createdAt} (denormalized names for audit trail)
- RoomParticipant {id, auctionId, teamId?, name, role: ORGANIZER|MANAGER|VIEWER, userId?, online, lastSeen, joinedAt}
- Setting {key id, value}

### Cricket roles: Batsman, Bowler, All-rounder, Wicketkeeper. Football roles: Goalkeeper, Defender, Midfielder, Forward.
### Categories: A, B, C, D, E (category mode only). Currency: ৳ BDT via `formatBDT()` (en-IN lakh grouping → ৳1,20,000).

### REST API (all under /api, JSON; auth via cookie; ownership checks: organizerId or ADMIN)
- `POST /api/auth/register` {name,email,phone?,password,role: ORGANIZER|MANAGER} → {user}; sets cookie
- `POST /api/auth/login` {email,password} → {user}; `POST /api/auth/logout`; `GET /api/auth/me` → {user|null}
- `POST /api/auth/forgot-password` {email} → generic {message} (emails a 30-min single-use link `#/reset-password/<token>` via Resend; token stored as SHA-256); `POST /api/auth/reset-password` {token,password} → {ok} (bumps User.sessionVersion → signs out all sessions)
- `GET /api/tournaments` → {tournaments:[{...t, playerCount, soldCount, teamCount, roomCode?, auctionStatus?}]} (own, or all if ADMIN)
- `POST /api/tournaments` {name,sport,tournamentType?,location?,startDate?,auctionAt?,auctionMode,basePrice?,description?} → {tournament}
- `GET /api/tournaments/:id` → {tournament: {...t, players:[], teams:[], auction?}} (owner/ADMIN; also MANAGER of a team in it may GET minimal)
- `PATCH /api/tournaments/:id` (partial fields), `DELETE /api/tournaments/:id` (not while LIVE)
- `POST /api/tournaments/:id/players` {players:[{name,phone?,role,category?,basePrice,previousTeam?}]} → {created:N}
- `POST /api/tournaments/:id/players/import` {csv:string} → {created, errors:[{row,error}]}
- `PATCH /api/players/:id`, `DELETE /api/players/:id` (not if status LIVE/SOLD)
- `POST /api/tournaments/:id/teams` {teams:[{name,color?,captainName?,logoUrl?,budget,maxSquad,minSquad}]}
- `PATCH /api/teams/:id`, `DELETE /api/teams/:id` (not if has sold players)
- `POST /api/tournaments/:id/auction` {bidTimerSeconds?,minIncrement?,goingIntervalSeconds?} → {auction} (roomCode generated, status READY, tournament → READY)
- `PATCH /api/tournaments/:id/auction` {settings} (only when not LIVE)
- `GET /api/rooms/:code` → public room info {roomCode, auctionId, tournamentId, tournamentName, sport, mode, status, teams:[{id,name,color,budget,spent,squadCount,maxSquad,minSquad,captainName,managerUserId}], myRole? ('organizer' if session user is owner/ADMIN)}
- `POST /api/rooms/:code/join` → identity + socket token.
  - body {role:'organizer'} (requires owner/ADMIN session) → {socketToken}
  - body {role:'manager', name, teamId} → {socketToken, identity:{role:'MANAGER',teamId,teamName,name}}; if team.managerUserId set and differs from session user → 403 (claim via login)
  - body {role:'viewer', name} → {socketToken, identity:{role:'VIEWER',name}}
- `GET /api/tournaments/:id/export?type=players|sold|unsold|squads|bids|spending|template` → text/csv (UTF-8 BOM)
- `GET /api/tournaments/:id/results` → {summary:{totalPlayers,sold,unsold,available,skipped,teams,totalBids,totalValue}, teams:[{...team, players:[sold players]}], recentBids}
- `GET /api/admin/stats` → {users, organizers, managers, tournaments, liveAuctions, players, bids, totalValue}
- `GET /api/admin/users` → {users:[{...u, tournamentCount}]}; `PATCH /api/admin/users` {userId, status: ACTIVE|BLOCKED}
- `GET /api/admin/tournaments` → {tournaments:[{...t, organizerName, counts}]}
- `GET /api/my/teams` → {teams:[TeamDTO & {tournamentName, tournamentStatus, tournamentId, roomCode?, auctionStatus?}]} for logged-in MANAGER (teams where managerUserId = me)
- `GET /api/admin/settings` → {settings: Record<string,string>}; `PUT /api/admin/settings` {settings: Record<string,string>} (ADMIN only)

### Socket contract (mini-service, port 3003; room = `auction:{auctionId}`)
Client→Server:
- `join_room` {token} → **ack callback** `{ok:true, state:RoomState}` | `{ok:false, error}` (token = HMAC from join API)
- `place_bid` {amount} (identity from token; MANAGER only)
- `organizer_action` {action, payload?} — action ∈ start|pause|resume|next_player|select_player{playerId}|set_category{category}|skip|force_sell|force_unsold|reauction{playerId}|manual_bid{teamId,amount}|end
Server→Client:
- `room_state` RoomState (FULL snapshot broadcast on every change — clients just replace state)
- `timer` {remainingMs, stage, serverTime} every 1s while LIVE+player+not paused
- `notification` {id, level: 'info'|'success'|'warning'|'error', message}
- `error` {message} (e.g. rejected bid)

```ts
interface RoomState {
  auctionId: string; roomCode: string; tournamentId: string; tournamentName: string
  sport: 'CRICKET'|'FOOTBALL'; mode: 'CATEGORY'|'NORMAL'
  status: 'READY'|'LIVE'|'PAUSED'|'ENDED'
  currentCategory: string|null
  categories: { code: string; total: number; available: number; basePrice: number }[]
  currentPlayer: { id:string; playerNumber:number; name:string; role:string; category:string|null; basePrice:number; photoUrl:string|null; previousTeam:string|null; phone:string|null } | null
  currentBid: { amount:number; teamId:string; teamName:string; teamColor:string|null } | null
  currentBidHistory: { teamId:string; teamName:string; amount:number; createdAt:string }[]
  stage: 0|1|2            // 0 = bidding, 1 = GOING ONCE, 2 = GOING TWICE
  timerEndsAt: number|null // epoch ms
  serverTime: number
  pausedRemainingMs: number|null
  teams: { id:string; name:string; color:string|null; logoUrl:string|null; budget:number; spent:number; remaining:number; squadCount:number; maxSquad:number; minSquad:number; online:boolean }[]
  participants: { name:string; role:'ORGANIZER'|'MANAGER'|'VIEWER'; teamId:string|null; online:boolean }[]
  players: { id:string; playerNumber:number; name:string; role:string; category:string|null; basePrice:number; status:'AVAILABLE'|'LIVE'|'SOLD'|'UNSOLD'|'SKIPPED'; soldPrice:number|null; teamName:string|null }[] // full pool
  pool: { total:number; available:number; sold:number; unsold:number; skipped:number }
  lastResult: { playerName:string; playerNumber:number; teamId:string|null; teamName:string|null; price:number|null; type:'SOLD'|'UNSOLD'; at:string } | null
  soldFeed: { playerName:string; teamName:string; price:number; at:string }[] // latest first
  minIncrement: number; bidTimerSeconds: number; goingIntervalSeconds: number
}
```

### Engine rules (mini-service, in-memory authoritative + DB persistence)
- Bid valid when: status LIVE, currentPlayer set, amount int; first bid ≥ basePrice; later ≥ currentBid+minIncrement; amount ≤ team.remaining (budget−spent); team.squadCount < team.maxSquad
- Successful bid → Bid row + Auction update + stage=0 + timerEndsAt=now+bidTimerSeconds*1000
- Timer expiry: stage 0→1 "GOING ONCE" →1→2 "GOING TWICE" (+goingIntervalSeconds each) → SOLD (if bid) else UNSOLD
- SOLD: player SOLD + soldPrice + soldToTeamId, team.spent += price, bidCount++, notification broadcast
- next_player: random AVAILABLE player (filtered by currentCategory in CATEGORY mode)
- reauction{playerId}: clears SOLD/UNSOLD/SKIPPED (refunds team.spent if SOLD), sets player LIVE as current player
- end: LIVE player → AVAILABLE, auction ENDED, tournament COMPLETED
- State rebuilds from DB if service restarted (on first join)

## Component ownership (frontend, all inside the single SPA)
- src/components/app-root.tsx (hash router/shell) — Task 1 (done, do not edit without coordination)
- src/components/landing.tsx, auth-view.tsx, organizer/*, admin/* — Task 3-a
- src/components/room/*, manager/*, results/* — Task 3-b
- Shared helpers: src/lib/{api,router,store,use-auction-socket,format,csv,types}.ts + src/components/shared/* — Task 1 (do not edit)

## Demo accounts (after seed)
- Admin: admin@neelamghor.bd / admin1234
- Organizer: organizer@neelamghor.bd / demo1234 (owns "Mirpur Corporate Cricket League 2026" + "Dhaka 6-a-side Football Cup")
- Manager: manager@neelamghor.bd / demo1234
- Demo room codes: `BD26-DEMO` (cricket, category mode), `BD26-FB01` (football, normal mode)

---
Task ID: 1
Agent: Z.ai Code (main)
Task: Foundation — worklog/contract, Prisma schema, shared libs, hash-router shell, socket client hook, seed data, hero image

Work Log:
- Explored scaffold (Next 16, Prisma+SQLite, shadcn/ui, socket.io example, Caddyfile XTransformPort gateway)
- Wrote Prisma schema (User/Tournament/Player/Team/Auction/Bid/RoomParticipant/Setting; strings not enums for SQLite)
- Created shared libs: crypto.ts (scrypt + HMAC tokens), auth.ts (session cookie), format.ts (BDT), csv.ts, types.ts, api.ts, router.ts, store.ts, use-auction-socket.ts
- Created app shell (hash router, guards, header/footer sticky), shared components, component stubs
- Seeded demo data (2 tournaments, 56 players, 12 teams, rooms BD26-DEMO/BD26-FB01, 3 accounts)
- Generated hero image for landing page

Stage Summary:
- Foundation complete; contract frozen (see above). Tasks 2-a/2-b/3-a/3-b run in parallel against this contract.
---
Task ID: 2-a
Agent: full-stack-developer
Task: All Next.js REST API routes

Work Log:
- Read frozen contract (worklog + types.ts + auth/crypto/csv/db libs + prisma schema) before writing code
- Created private shared module src/app/api/_lib/helpers.ts (underscore folder = not routed): readJson, requireSession/requireSessionRole, loadTournamentForOwner/loadPlayerForOwner/loadTeamForOwner guards, coerceInt/coercePositiveInt/clampInt, parseDateInput, normalizeCategory (A–E, uppercased), toSafeUser + serializers (TournamentSummary/TournamentFull/PlayerDTO/TeamDTO/AuctionDTO), soldCountsByTournament (single groupBy for sold counts)
- Auth: register (zod v4, role limited to ORGANIZER|MANAGER — ADMIN explicitly 400, email lowercased+unique 409, password ≥6, sets ng_session cookie, 201), login (case-insensitive email, verifyPassword, BLOCKED → 403 "Your account has been blocked. Please contact support."), logout (clears cookie), me ({user|null})
- Tournaments: GET list (ORGANIZER→own, ADMIN→all, MANAGER→[] by contract; each shaped as TournamentSummary incl. playerCount/soldCount/teamCount/roomCode/auctionStatus); POST (ORGANIZER/ADMIN, name 2–80, sport CRICKET|FOOTBALL, auctionMode CATEGORY|NORMAL default CATEGORY, basePrice clamped ≥1, ISO dates validated, status DRAFT); GET /:id (owner/ADMIN full detail with players[playerNumber asc, soldToTeamName], teams[name asc, squadCount], auction; MANAGER managing a team in the tournament also gets the full detail; others 403); PATCH (owner/ADMIN, allowed fields only, 409 on auctionMode change when status LIVE/COMPLETED, status field ignored); DELETE (owner/ADMIN, 409 while auction LIVE, manually deletes RoomParticipants then cascades rest)
- Players: POST batch (validates name/role non-empty, category normalized to A–E, basePrice positive int; sequential playerNumber from max+1; 201 {created, players}); POST import (parseCsvObjects, headers 'baseprice'|'base_price', 'previousteam'|'previous_team', empty rows skipped, row errors as {row: N} using real CSV line numbers with header=1, basePrice fallback: CATEGORY mode + category → DEFAULT_CATEGORY_BASE_PRICES else tournament.basePrice); PATCH /api/players/:id (owner/ADMIN via tournament, 409 'Player is on the block right now' when LIVE); DELETE (409 when LIVE or SOLD)
- Teams: POST batch (name 2–60, budget/maxSquad >0, minSquad ≥0, minSquad≤maxSquad); PATCH (budget raise always ok, lowering below spent → 409, managerUserId assignable by owner/ADMIN with user-exists check, color/captainName/logoUrl nullable); DELETE (409 when team has SOLD players)
- Auction setup: POST (requires ≥1 team and ≥1 player → 400, existing auction → 409, clamps bidTimer 5–120 default 20 / going 3–60 default 8 / increment 500–100000 default 5000, roomCode via generateRoomCode with 5 retries on unique collision, auction READY + tournament READY); PATCH settings (only while auction READY → else 409)
- Rooms: GET /api/rooms/:code public (code normalized uppercase, 404 'Room not found. Check the code and try again.', RoomInfo shape with RoomTeamInfo[] incl. squadCount, myRole='organizer' when session user is owner/ADMIN else null); POST /:code/join public (organizer → requires owner/ADMIN session → 403 else; manager → name 2–40 + teamId in tournament, claimed team + wrong/no session → 403 'This team is registered to another manager. Please log in with that account.', token payload {auctionId, roomCode, role:'MANAGER', name, teamId, teamName, userId?}; viewer → name 2–40; socketToken = signToken(payload, 12*3600); upserts RoomParticipant unique[auctionId,role,name] with online=false)
- Exports (owner/ADMIN): ?type=players|sold|unsold|squads|bids|spending|template, all UTF-8 BOM (\uFEFF) + Content-Type 'text/csv; charset=utf-8' + Content-Disposition attachment filename="neelamghor-<type>-<slug>.csv"; unknown type 400; template ships 2 example rows (cricket Shakib Hasan / football Tanvir Ahmed)
- Results GET /api/tournaments/:id/results: any authenticated user; summary {totalPlayers, sold, unsold, available, skipped, teams, totalBids, totalValue}, teams (TeamDTO + sold players[]), recentBids (last 50 desc), tournament {id,name,sport,location,startDate,status,roomCode}
- My teams GET /api/my/teams: teams where managerUserId=me incl. tournamentName/tournamentStatus/tournamentId/roomCode/auctionStatus
- Admin (all ADMIN-gated): GET stats (users/organizers/managers/tournaments/liveAuctions/players/bids/totalValue); GET users (+tournamentCount); PATCH users {userId,status} (self → 400, admin target → 400); GET tournaments (+organizerName); GET/PUT settings (≤20 keys, values ≤500 chars, upsert each)
- Tested with two curl suites (main flow + follow-up edge cases): 87 checks passed, 0 real failures. Fixed during testing: relative import depth bugs in admin/* and rooms/join routes, a `never[]` typed array in teams route, Prisma upsert typing in settings — all caught by `bunx tsc --noEmit` then re-verified. Final `bun run lint` clean; dev.log shows no 5xx.

Stage Summary:
- All 20 REST endpoints from the frozen contract implemented and verified live (see curl results above; test scripts kept at /home/z/test-tmp/test-2a*.sh outside the project)
- Verified against seeded data: admin@neelamghor.bd login OK, organizer tournament list with counts OK, public room info for BD26-DEMO / BD26-FB01 OK (case-insensitive codes)
- Deviations/notes for integrator:
  1) Sessions are stateless HMAC tokens — logout clears the cookie; a replayed old cookie would still validate (per contract design, no server-side session store)
  2) CSV import row numbers are actual file line numbers (header = row 1, first data row = 2)
  3) GET /api/tournaments returns [] for MANAGER role (contract lists ORGANIZER/ADMIN only) — managers should use /api/my/teams
  4) RoomParticipant upsert keys on unique[auctionId, role, name]; manager joins also store teamId/userId; socket service (Task 2-b) sets online presence
  5) Team DELETE only blocks on players with status SOLD (a re-auctioned player would free the team); bids cascade on team delete
  6) PATCH /api/tournaments/:id ignores a `status` field entirely (transitions only via auction engine); all other listed fields update
  7) Shared private helpers live at src/app/api/_lib/helpers.ts (excluded from routing) — do not confuse with src/lib

---
Task ID: 2-b
Agent: general-purpose
Task: Auction engine socket.io mini-service (port 3003)

Work Log:
- Read worklog contract, types.ts, crypto.ts, schema.prisma, examples/websocket/server.ts
- Created mini-services/auction-service/: package.json (socket.io ^4.8.3, dev = `bun --hot index.ts`), env.ts, engine.ts, index.ts, scripts/smoke.ts; `bun install` done
- index.ts: http+socket.io server (path '/', CORS '*', ping 60s/25s), join_room with ack {ok,state}|{ok,error} — verifyToken<SocketIdentity>, roomCode uppercased, token.auctionId must match auction for roomCode; place_bid (MANAGER only), organizer_action (ORGANIZER only) routed to engine; error events are per-socket; graceful SIGTERM/SIGINT
- engine.ts: AuctionEngine — one in-memory Room per auctionId {status, currentPlayerId, currentBid, currentBidHistory, stage, timerEndsAt, pausedRemainingMs, lastResult, soldFeed(max 12), cached auction/tournament/teams(+squadCount)/players/participants, socket presence map}; per-room async lock serializes bids/actions/ticker; global 500ms ticker (stage 0→1 'GOING ONCE!' →2 'GOING TWICE!' → SOLD/UNSOLD) + 1s `timer` emitter while LIVE+player+not paused
- All transitions persist via db.$transaction: sold (player SOLD+soldPrice+soldToTeamId, team.spent+=price, auction current fields cleared), unsold, skip (SKIPPED), reauction (refund floor 0, clears sold fields, LIVE as current; READY→LIVE also flips tournament), end (LIVE players→AVAILABLE, auction ENDED, tournament COMPLETED); bids write Bid row + auction{currentBidAmount,currentBidTeamId,bidCount increment}; ৳ amounts via Intl.NumberFormat('en-IN')
- Presence: RoomParticipant upsert on join (unique auctionId+role+name, manager carries teamId), online = any live socket for identity/team; disconnect marks DB offline; presence broadcasts throttled 200ms
- Rebuild: room built from DB on first join after service start (status mapped, currentBid/currentBidHistory/soldFeed reconstructed from bids, LIVE→fresh timer, PAUSED→pausedRemainingMs) + `syncIfStale` on join heals memory if DB diverged (verified: externally reset room serves correct READY state)
- Smoke test (scripts/smoke.ts) on BD26-DEMO: resets room→READY, signs real tokens, 2 clients join (lowercase roomCode normalized), start → currentPlayer + notification + timer event, manager bid at basePrice → room_state.currentBid + Bid row + bidCount, pause/resume, low bid rejected with 'Minimum bid is ৳X' error and no state change, force_sell → player SOLD + team.spent updated, set_category A↔B, end → ENDED/COMPLETED; room restored to READY after (runs passed 2/2)
- Extra ad-hoc checks on BD26-FB01 (temp script, deleted after): GOING ONCE/TWICE/auto-UNSOLD with 2s/1s timers, select_player on UNSOLD (re-list), manual_bid (Bid row + notification), force_sell → reauction refund path, skip → next_player — all pass; FB01 restored
- Final state: both rooms pristine (READY, 40/40 and 16/16 AVAILABLE, 0 bids, 0 participants); service left RUNNING (bun --hot, PID detached, log: /home/z/auction-service.log → actually /home/z/my-project/auction-service.log)

Stage Summary:
- Files owned/created: mini-services/auction-service/{package.json, env.ts, engine.ts, index.ts, scripts/smoke.ts}. NO other repo files modified.
- Deviations (small, documented): (1) added env.ts bootstrap — Bun only auto-loads the .env next to the service's package.json, so env.ts loads the parent .env for DATABASE_URL/AUCTION_SECRET; it is imported first in index.ts and smoke.ts and never overrides real env vars. (2) index.ts injects a single PrismaClient into the engine constructor (one pool, per skeleton). (3) team ordering uses `name` (Team has no createdAt). (4) force_sell with NO current bid is rejected ('No bid to sell — use Force Unsold instead') since there is no buyer; force_sell with a bid sells at the bid amount. (5) next_player/select_player are rejected while a player is already on the block (prevents orphaned LIVE players); reauction overrides the block and auto-returns any other LIVE player to AVAILABLE. (6) Engine status/heal: `syncIfStale` on join also makes the room self-heal if the DB was changed externally (used by smoke reset).
- bidCount increments per successful bid (per task spec; worklog's 'bidCount++ on SOLD' line was superseded).
- State model: memory authoritative for timers/stage/presence; DB authoritative for auction/players/teams/bids; every state change persists in a transaction then broadcasts a FULL RoomState on `auction:{auctionId}`; clients only replace state (contract kept).
- Integrator notes: start with `cd mini-services/auction-service && bun run dev` (port 3003, path '/'); tokens come from POST /api/rooms/:code/join (2-b consumed none of the REST routes); re-run `bun scripts/smoke.ts` anytime — it resets/restores BD26-DEMO around itself. Process was left running detached (PPID 1); if the sandbox reaped it, restart with: `( setsid bun --hot index.ts > /home/z/my-project/auction-service.log 2>&1 < /dev/null & )` from the service folder (plain `nohup … &` gets reaped between shell sessions here).

---
Task ID: 3-a
Agent: full-stack-developer
Task: Frontend — landing, auth, organizer pages, admin

Work Log:
- Read worklog contract + all foundation files (types.ts, api.ts, router.ts, store.ts, format.ts, app-root.tsx, shared/*) before writing any UI; reused shared components everywhere (StatCard, EmptyState, PlayerAvatar, TeamAvatar, status badges, formatBDT/formatDate)
- landing.tsx: premium marketing page — 2-col hero (badge "Made for Bangladesh", H1, CTA → /register and /join, trust line, /images/hero.png in shadow frame, floating "SOLD" chip), 4-stat strip, How-it-works (Organizer 6-step vs Manager 5-step parallel cards, amber accent for manager), 6-feature grid (Gavel/Timer/Shuffle/Wallet/Users/FileSpreadsheet icons... Timer variant via ListChecks per palette rules), Cricket & Football role cards + 7 tournament-type chips, gradient teal/emerald final CTA band; framer-motion whileInView(once) fade/slide on every section, motion-safe and fast (0.5s)
- auth-view.tsx: centered max-w-md card; login (email+password) and register (name, role picker as two selectable cards Organizer/Team Manager, email, optional phone, password+confirm with validation); ApiError shown inline in destructive Alert AND toast.error; demo box (border-dashed) lists the 3 seeded accounts with per-account "Fill" buttons; bottom link switches mode via navigate; success → setUser → toast.success("Welcome back, {first}!") → /dashboard
- organizer/dashboard.tsx: "Assalamu alaikum, {firstName}" + Organizer chip + New tournament CTA; 4 StatCards computed from GET /api/tournaments (tournaments, Σ playerCount, Σ teamCount, LIVE count); My tournaments grid (first 6) using shared TournamentCard with Manage/Results actions; 6-step quick-guide checklist card; EmptyState + CTA when no tournaments
- organizer/tournament-card.tsx (new shared helper in my scope): reusable summary card — sport icon, name, type/location line, dates, TournamentStatusBadge, sold/players Progress, room code + copy button, action footer slot; exports copyRoomCode() helper (clipboard + 'Room code copied' toast)
- organizer/tournaments.tsx: search/sport/status client-side filters with live count; responsive card grid; per-card DropdownMenu → Manage / Auction history / Results / Export submenu (players|sold|unsold|squads|bids|spending via apiDownload `${slug}-${type}.csv`) / Delete (AlertDialog; 409 messages like live-auction surfaced via toast); Delete confirm dialog shared pattern with destructive action
- organizer/tournament-create.tsx: 3-step wizard with clickable stepper (1 Basics, 2 Auction mode, 3 Review) and framer-motion slide transitions; step validation gates Next; Step 2 = two mode cards (CATEGORY default with per-category suggested base price inputs labelled "suggested defaults you'll use when adding players" — NOT sent to API; NORMAL with single basePrice, default 10000); Step 3 = dl review list; create → POST /api/tournaments (dates sent as ISO) → toast → /tournaments/{id}
- organizer/tournament-detail.tsx (+ 3 sub-tab files): loads GET /api/tournaments/:id; header with back link, logo (if logoUrl), name + TournamentStatusBadge, sport/type/location/dates/mode chips, actions dropdown (Export submenu, Results, History, Delete); bannerUrl strip; Tabs = Overview | Players | Teams | Auction Setup (auction dot indicator)
  - players-tab.tsx: search + category(A–E, only in CATEGORY mode)/status/role filters; desktop sticky-header table (#, avatar+name+ex-team, role, cat, base, status badge, sold price+team, edit/delete) with max-h-96 scroll; mobile card list; Add/Edit Dialogs sharing PlayerFormFields (name, role Select per sport from CRICKET_ROLES/FOOTBALL_ROLES, category A–E when CATEGORY, basePrice with quick-pick buttons of DEFAULT_CATEGORY_BASE_PRICES, phone, previousTeam) → POST batch / PATCH /api/players/:id; Delete AlertDialog 409-aware; Import Dialog = template download button (type=template) + file input (FileReader.readAsText) + CSV textarea + results panel (created N + row errors) → POST /players/import
  - teams-tab.tsx: team cards (TeamAvatar with color, captain w/ Crown, budget/remaining, spent Progress, squad x/max, Manager-linked vs Open-to-claim badge) with edit (name/color picker+hex/captain/budget/max/min) and 409-aware delete; AddTeamDialog mounted only while open so form starts fresh, color auto-suggested from first unused TEAM_PALETTE entry
  - auction-setup-tab.tsx: no auction → EmptyState + prereq warning card (needs ≥1 player & team) + settings form (bidTimer 10/15/20/30/45/60 default 20, going 5/8/10/15 default 8, increment 1000/2000/5000/10000 default 5000) → POST /auction; exists → gradient hero with room code in huge mono, Copy code / Copy invite message ("NeelamGhor Live Auction — {name}. Room Code: {code}. Join: {origin}/#/room/{code}", no emoji) / WhatsApp share anchor (wa.me, target _blank) / status+bidCount badges / Results+History+Open auction room buttons; settings form PATCH disabled with amber note when status ≠ READY; key'd remount keeps form in sync with auction
- organizer/auction-history.tsx: GET /results (no invented endpoints) → 4 summary StatCards (bids, sold, unsold, total value); recentBids grouped by player into Collapsible cards showing bid count + top bid, winner badge (team+price) derived from teams[].players SOLD data; expanded chronological ladder with numbered rows, final bid highlighted teal with "Won" badge; Download full CSV (type=bids) + Print (window.print, header/footer already print:hidden); limitation note about 50-bid feed
- admin/admin-view.tsx: 4 tabs; Overview = 8 StatCards from /api/admin/stats + announcement banner from settings.announcement (dashed placeholder when unset); Users = search + sticky-header table (name/email, phone, role badge, status badge, joined, tournamentCount) + Block/Unblock AlertDialog → PATCH /api/admin/users, ADMIN rows show Protected and are unblockable, self-block disabled (user from useAppStore); Tournaments = search + desktop table (organizer, sport, status, sold/players, teams, roomCode) + mobile cards, View results link; Settings = fixed keys siteName/supportPhone/announcement (always present, ordered first, hinted) + free-form key/value rows with add (max 20, values ≤500) and per-row remove (fixed keys locked) → PUT /api/admin/settings (PUT via generic api helper since api.ts has no apiPut)
- Verification: bunx tsc --noEmit clean for project code; bun run lint clean (fixed my own react-hooks/refs + set-state-in-effect violations by remounting AddTeamDialog and key-remounting AuctionSetupTab instead of syncing state in effects; also fixed Textarea import, TEAM_PALETTE import source, apiPut→api, and a toast-return typing issue); dev.log shows clean compiles, GET / 200; live curl end-to-end test of organizer flows (create tournament via wizard payload → add player → add team → create auction → template CSV → results → delete) all 200, test data cleaned up
- Note: two transient lint errors seen in src/components/room/* and manager/* during the run belong to Task 3-b (parallel agent) and were not touched by me; final full-project lint passes with 0 problems

Stage Summary:
- All 8 owned surfaces delivered + 3 helper files created inside my scope (organizer/tournament-card.tsx, organizer/players-tab.tsx, organizer/teams-tab.tsx, organizer/auction-setup-tab.tsx); no files outside my ownership modified
- UX decisions: wizard category prices are presentation-only hints (contract: API takes auctionMode+basePrice only); history uses the frozen /results endpoint (recentBids 50) with clear CSV-download path for the full audit trail; admin PUT uses the generic `api()` helper; dialogs validate client-side and surface server 409s verbatim via toast
- Integrator notes: (1) AuctionHistory winner detection relies on results.teams[].players containing sold players — matches Task 2-a contract; (2) room join URLs use `${window.location.origin}/#/room/${code}`; (3) managers flow (3-b) should read roomCode from TournamentSummary/ResultsData shapes as used here; (4) if any dialog ever needs server-driven defaults after refetch, prefer key-remount over setState-in-effect to satisfy the strict react-hooks lint config

---
Task ID: 3-b
Agent: full-stack-developer
Task: Frontend — live auction room, manager pages, results

Work Log:
- Read frozen contract (worklog RoomState/socket rules, types.ts, use-auction-socket.ts, api/router/store/format, shared avatars/badges/empty-state, app-root exact export names) before writing code; verified ui/ component inventory
- Room folder (src/components/room/, 10 files): auction-room.tsx orchestrator + countdown-ring.tsx (SVG stroke-dasharray ring, emerald >10s / amber 6–10s / rose <=5s pulse), result-overlay.tsx (AnimatePresence SOLD/UNSOLD moment, ~5s auto-dismiss keyed by lastResult.at, sparse teal/amber confetti on SOLD), stage.tsx (shared money-screen: ON THE BLOCK kicker + PLAYER #N mono, PlayerAvatar, role/category/base/ex-team chips, pop-in on player change via key=id, GOING ONCE/TWICE pulsing banners, current-bid block with TeamAvatar, ReadyHero for READY, ENDED panel → View results), join-card.tsx (role segmented control Manager/Viewer, team Select showing all teams + "registered" marker, auto-prefill for logged-in manager's claimed team, API 403 messages surfaced in Alert), bid-panel.tsx (team card w/ remaining BIG + budget Progress, min-next-bid callout, 3 quick-bid h-14 buttons [first bid anchors base/base+10k/base+20k; with a bid: min+inc/+10k/+20k] with over-budget strikethrough + 'over budget' tag, custom amount row with full client validation mirroring engine rules, disabled reasons per auction state), organizer-controls.tsx (Start Auction, Next player random [disabled while player on block], Skip, Sell now/Unsold/End auction with AlertDialog confirms incl. refund copy, Pause/Resume, Manual bid Dialog with team Select + amount validation, CategoryChips A–E with available counts + base prices), teams-panel.tsx (budget/spent/remaining, squad x/max+min, spend Progress, online dot, highest-bidder ring highlight), participants-panel.tsx (role icons Crown/UserCog/Eye, online dots, ActivityFeed newest-first with level-colored dots), player-pool-panel.tsx (status filter pills with counts + search + category Select, max-h-[420px] scroll list, row click → select_player confirm when AVAILABLE+no player+LIVE, row menu → reauction confirm with refund copy for SOLD, SoldFeed chips strip extracted for reuse), squad-panel.tsx (manager squad list + bid ladder newest-highlighted)
- auction-room.tsx flow: GET /api/rooms/{code} (404 → styled not-found panel), identity via loadRoomIdentity → organizer auto-join (POST join {role:'organizer'} → saveRoomIdentity) → JoinCard gate; useAuctionSocket always mounted (null token safe); connection chip Live/Joining…/Connecting…; joinError panel with Retry (rejoin) + Switch seat (clearRoomIdentity → join card); Leave button for MANAGER/VIEWER; layouts: ORGANIZER lg:grid-cols-[1fr_380px] with stage→pool rows + right rail KPI strip/controls/teams/participants/activity, MANAGER lg:grid-cols-[1fr_360px] with stage→bid-panel→squad DOM order (mobile: stage, bid console, squads), VIEWER stage + note + teams/sold-feed/activity; roomCode-change reset via render-time adjustment pattern (React Compiler set-state-in-effect rule compliant)
- Manager views: join-room.tsx (Gavel card, mono uppercase letter-spaced code input maxLength 9, hint, demo-room shortcut), manager-dashboard.tsx (greeting + Join room CTA, /api/my/teams → KPI StatCards, team cards with budget grid+Progress+squad counts, Enter auction room when auctionStatus READY|LIVE|PAUSED + Live now badge, View squad / Results buttons, My auctions deduped by tournamentId, EmptyState with Users icon), my-team.tsx (multi-team selector chips, tournament detail load, StatCards Budget/Spent/Remaining/Squad, min-squad warning Alert, squad table sorted by price desc with PlayerAvatar; stale-detail keyed by teamId so switching teams never flashes wrong squad)
- Results: results-view.tsx (GET results → header w/ status badge + roomCode chip + date, Print report via window.print(), Export dropdown → apiDownload for players/sold/unsold/squads/bids/spending, 6 StatCards matching spec numbers incl. totalValue, championship banner when all teams meet minSquad, final squads grid with per-team players sorted price desc + max-h-96 scroll + footer count/avg, recent bids table max-h-96, @media print style block: white bg, smaller base font, break-inside-avoid on cards, app chrome already print:hidden)
- Verification: bunx tsc --noEmit clean for src; fixed 3 react-hooks/set-state-in-effect violations in my files (boot effect → async-after-await only, result overlay dismiss key pattern, my-team detail load) and a TS narrowing error (params into async closure); full bun run lint passes with 0 errors; smoke test /home/z/test-tmp/test-3b.ts: 13/13 checks (my/teams shape, results summary shape, room info, manager/viewer joins, 400 validation, socket join_room ack with full RoomState key verification against port 3003); test RoomParticipant rows deleted via /home/z/test-tmp/cleanup-3b.ts — BD26-DEMO verified pristine (READY, 40 AVAILABLE, 0 bids, spent 0); dev.log shows clean compiles, no 5xx
- Did NOT touch src/lib/*, app-root, shared/*, ui/*, landing/auth/organizer/admin, src/app, mini-services, prisma

Stage Summary:
- The live auction room is complete for all three seats: organizer (full cockpit: category order, pool selection/re-auction, sell/unsold/pause/end, manual bid), manager (phone-first bid console with one-tap increments + custom bid + budget guardrails), viewer (read-only wall with teams board and activity). The stage is shared and dramatic: pulsing player card, countdown ring with going-once/twice urgency states, and a SOLD/UNSOLD takeover with confetti.
- Key UX decisions: (1) identity lives in sessionStorage per room with an explicit Leave/Switch-seat escape hatch — refresh keeps your seat, no account needed for room seats; (2) client-side bid validation mirrors engine rules exactly (min bid, remaining budget, squad cap) so managers get instant inline feedback while the socket error toast remains the authority; (3) quick-bid buttons re-anchor (base price on first bid, current bid + increments afterwards) and show computed amounts with over-budget strikethrough; (4) mobile order stage→bid→squad achieved via grid row placement, no fixed/sticky hacks; (5) roomCode change resets room state via the adjust-during-render pattern to satisfy the new React hooks lint rules.
- For the integrator: room view depends only on the frozen contract (RoomInfo/JoinResult/RoomState + socket hook); demo flow = manager@neelamghor.bd (Dhaka Warriors) → /join → BD26-DEMO; organizer gets auto-seated when the owner opens their room; results route is open to any logged-in user. Test artifacts kept outside the repo at /home/z/test-tmp/ (test-3b.ts, cleanup-3b.ts).

---
Task ID: 4
Agent: Z.ai Code (main)
Task: Integration — lint, end-to-end browser verification, fixes, final state

Work Log:
- Verified all 4 subagent deliverables; lint clean across the whole repo
- Discovered browser tests must go through the Caddy gateway (port 81) for XTransformPort socket routing — localhost:3000 bypasses it
- End-to-end verified via agent-browser (desktop 1280px + mobile 390px):
  * Landing page (hero image, flows, features) renders with zero console errors
  * Login organizer → dashboard (KPIs, 2 tournaments) → tournament detail (players 40, teams 8, auction setup with room code BD26-DEMO + WhatsApp share)
  * LIVE AUCTION: organizer start → random player on block w/ countdown ring → guest manager joined in 2nd browser session (Mirpur Kings) → bid ৳50,000 → bid raised to ৳60,000 → real-time sync across sessions (toasts, current bid, re-anchored buttons, timer reset) → Sell now → SOLD overlay + confetti → team budget updated (spent ৳60,000 / left ৳9,40,000) → pool stats 38/1/1
  * Engine: auto-UNSOLD after timer (Nurul Hasan), re-auction (player back on block), skip, force unsold, end auction → results page (squads, budget bars, recent bids audit trail)
  * CSV exports verified via curl: template/players/sold/unsold/squads/spending (UTF-8 BOM)
  * Manager login → manager dashboard (my teams) → my-team (budget cards, min-squad warning)
  * Admin console (stats, users, tournaments, settings)
  * Football room BD26-FB01 (normal mode, no categories) — correct behavior
- Fixes applied by integrator:
  1. auction-room.tsx: "Refresh seat" button (fresh organizer token when stored seat token is stale/expired) + "Switch seat" for all roles — no more retry traps
  2. join-card.tsx: "Take the organizer seat" option when the room owner manually left their seat
  3. stage.tsx + result-overlay.tsx: between-players waiting panel ("Waiting for the organizer… Last: …") — stage is never blank mid-auction
  4. Room header status now derives from live socket state (was stuck on initial REST status)
- Teal primary theme set (oklch 0.51 0.096 186); custom scrollbars added
- Final reseed → both demo rooms pristine READY; services running: next dev (3000) + auction engine (3003)

Stage Summary:
- MVP COMPLETE and browser-verified: organizer creates tournament → players (CSV/manual) → teams → room code → live randomized auction w/ timers, bids, budgets, sold/unsold → results + CSV/print. Demo accounts: admin@neelamghor.bd/admin1234, organizer@neelamghor.bd/demo1234, manager@neelamghor.bd/demo1234. Rooms: BD26-DEMO (cricket/category), BD26-FB01 (football/normal).

---
Phase 2 (growth) — invites, overlay, uploads, self-registration, Bangla

New hash routes: `#/invite/<token>` (manager accepts team invite), `#/overlay/<CODE>[/green]` (OBS overlay, no app chrome),
`#/register-player/<code>` (public player sign-up), `#/forgot-password`, `#/reset-password/<token>`.

New REST:
- `POST /api/teams/:id/invite` (owner/ADMIN) → {token, expiresAt} — 7-day single-use link, SHA-256 stored on Team.inviteTokenHash
- `GET /api/invites/:token` → team/tournament summary; `POST /api/invites/:token` (MANAGER session) → links team.managerUserId (replaces any previous manager)
- `Auction.allowOpenClaim` (default false): when false, unassigned teams cannot be self-claimed from the join card — managers come via invite or organizer email link. Seeded demo rooms set it true.
- `POST /api/uploads` multipart {file, kind: PHOTO|LOGO|BANNER[, registrationCode]} → {id, url}; images re-encoded to WebP by sharp (PHOTO 512² cover, LOGO 256² transparent contain, BANNER 1600×600), stored in Postgres `Upload`; `GET /api/uploads/:id` immutable cache
- `GET|POST|PATCH /api/tournaments/:id/registrations` (owner/ADMIN): list / open-close-rotate link / approve|reject (approve → Player rows via insertPlayersNumbered)
- `GET|POST /api/register/:code` (public): sign-up page info / submit (PlayerRegistration PENDING; phone de-duplicated per tournament)

i18n: `src/lib/i18n.ts` — per-component typed string tables (`useStrings`), language persisted in localStorage `ng_lang`, EN/বাং toggle in header. Bangla covers shell, auth, public pages and the live room for managers/viewers; organizer console and server-generated socket messages are still English.

---
Phase 3 (scale) — delta broadcasts, real URLs, insights

- Delta broadcasts: `room_state` omits `players` / `participants` when unchanged since the previous broadcast; every payload carries
  `playersHash` / `participantsHash`; clients merge via `src/lib/room-state.ts` and re-join for a full snapshot on a fingerprint gap.
  The join ack is always a full RoomState, and the socket joins the broadcast room before the snapshot is built.
  `participants` now lists seats only (organizer + managers); viewers are `viewersOnline` (count of live viewer sockets).
- Real URL paths: `src/app/[[...slug]]/page.tsx` serves the client app for every path and sets per-path link-preview metadata
  (room code → tournament name; registration code → "Register for …"); private pages are noindex. Client router (`src/lib/router.ts`)
  uses history.pushState; legacy `/#/…` links are rewritten on load. Reset and invite tokens travel in the fragment:
  `/reset-password#<token>`, `/invite#<token>`.
- Insights tab (organizer): `GET /api/tournaments/:id/analytics` — spend vs budget per team, avg price per category,
  most contested players (full bid history), biggest premiums over base price, sell-through.
- Not done on purpose: multi-instance auction engine (needs room ownership/forwarding across instances via Redis) and Redis-backed
  rate limits — deferred until a single instance is measured to be the bottleneck.
