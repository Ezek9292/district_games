# Taifa District of SDA

```
church-games/
├── backend/    Express + Prisma (PostgreSQL on Supabase) — REST API, OTP login, live updates
└── frontend/   Next.js — public scoreboard; organizers sign in to edit
```

**Who can do what**
- **Viewers** (`/`, no login): standings, schedule, teams, rosters and photos, and line-ups once a game is played.
- **Church reps** (`/church`, email + 6-digit code): register their church's players (gender, elder, photo)
  and submit a team sheet for each upcoming fixture. An organizer sets each church's rep email.
- **Organizers** (`/` → Organizer sign-in, email + 6-digit code): everything else — event name, churches and
  rep emails, games and their points rules, fixtures, results, any church's players, and other organizers.

**Team sheets** (checked on the server, see `backend/src/lib/formats.ts`)
| Format | Starters | Substitutes |
|---|---|---|
| Football | 11 | up to 5 |
| Volleyball | 6 | up to 6 |
| Penalty shoot-out | 5 kickers | up to 5 reserves (10 per church) |

Men's/women's games only accept players of that gender; elders-only games only accept players marked as elders.
Sheets lock once the organizer enters the result. Points come from each game's win/draw/loss rule.

## 1. Database (Supabase)

1. Create a Supabase project.
2. In **Project settings → Database → Connection string**, copy:
   - the **Transaction pooler** URI (port 6543) → `DATABASE_URL` (append `?pgbouncer=true`)
   - the **Session pooler** URI (port 5432) → `DIRECT_URL`

## 2. Backend

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, ORGANIZER_EMAILS, SMTP_*, CLOUDINARY_URL
npm install
npx prisma migrate dev --name init   # creates the tables in Supabase
npm run db:seed                       # creates the event row, organizers from ORGANIZER_EMAILS, and the 5 games
npm run dev                           # http://localhost:4000
```

Login codes are emailed via SMTP (any provider: Resend, Brevo, Gmail app password…).
In development, leave `SMTP_HOST` empty and the code is printed in the backend terminal; if the provider
refuses a recipient (e.g. Resend before a domain is verified), the code is printed there too.

Player photos are uploaded to Cloudinary (`CLOUDINARY_URL`), cropped to a 400×400 face-centred square.

## 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                          # http://localhost:3000
```

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/state` — event, churches, games, fixtures, players, line-ups of played games | public |
| GET | `/api/stream` — Server-Sent Events, `change` after every edit | public |
| POST | `/api/auth/request-otp` `{ email, as: "organizer" \| "church" }` | public (rate-limited) |
| POST | `/api/auth/verify-otp` `{ email, code, as }` → `{ token, role, … }` | public (rate-limited) |
| GET | `/api/auth/me` | signed in |
| PUT | `/api/event` | organizer |
| GET / POST / PATCH / DELETE | `/api/churches[/:id]` (GET lists rep emails) | organizer |
| POST / PATCH / DELETE | `/api/games[/:id]` (format, division, eldersOnly, points) | organizer |
| POST / PUT / DELETE | `/api/fixtures[/:id]`, PUT `/api/fixtures/:id/result` `{ scoreA, scoreB }`, GET `/api/fixtures/:id/sheets` | organizer |
| POST | `/api/churches/:churchId/players`, PATCH / DELETE `/api/players/:id`, POST `/api/players/:id/photo` | organizer |
| GET / POST / DELETE | `/api/organizers[/:id]` | organizer |
| GET | `/api/church/sheets` | church |
| PUT | `/api/church/fixtures/:id/sheet` `{ starters: [ids], subs: [ids] }` | church |
| POST / PATCH / DELETE | `/api/church/players[/:id]`, POST `/api/church/players/:id/photo` (multipart `photo`, ≤ 5 MB) | church |

Organizer requests send `Authorization: Bearer <token>` (7-day JWT). Codes are 6 digits, stored hashed,
expire after 10 minutes, allow 5 attempts, and can be re-requested once a minute.

## Deploying

- **Backend**: any Node 20+ host that keeps a long-running process (Render, Railway, Fly.io) — the live
  updates use a persistent SSE connection, so serverless functions aren't a good fit.
  - Root directory: `backend`
  - Build: `npm install --include=dev && npm run build && npm run db:deploy`
    (`--include=dev` matters: with `NODE_ENV=production` npm otherwise skips TypeScript and Prisma)
  - Start: `npm start` · Health check: `/health`
  - Env: everything in `backend/.env.example`, plus `NODE_ENV=production` and
    `FRONTEND_ORIGIN=https://your-frontend.app`. `SMTP_HOST` is required in production.
  - First deploy only: run `npm run db:seed` once (locally against the production `DATABASE_URL` works) to
    create the event row, the organizers from `ORGANIZER_EMAILS`, and the games.
- **Frontend**: Vercel or similar, root directory `frontend`, with `NEXT_PUBLIC_API_URL` set to the backend URL
  (it's baked in at build time, so redeploy after changing it).
