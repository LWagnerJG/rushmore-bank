# Rushmore Bank

Mobile-first multiplayer party game: **Mount Rushmore** rankings + **BANK** wagering.

Create a room → share a short code/link → friends join on phones → play with live sync (PartyKit WebSockets).

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS 4
- **PartyKit** for realtime shared rooms (Vercel-friendly: Next on Vercel, PartyKit on partykit.dev / Cloudflare)
- Optional **OpenAI** key for RushBot ranking help (`/api/bot`); heuristic fallback if unset

## Local development

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Env vars

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PARTYKIT_HOST` | Yes (for clients) | PartyKit host. Local: `127.0.0.1:1999`. Production: `your-project.yourname.partykit.dev` (no `https://`) |
| `OPENAI_API_KEY` | No | If set, `/api/bot` uses OpenAI for ranking suggestions; otherwise a fun heuristic bot |

### 3. Run (Next + PartyKit together)

```bash
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- PartyKit: `ws://127.0.0.1:1999`

Or separately:

```bash
npm run dev:party   # terminal 1
npm run dev:next    # terminal 2
```

### 4. Play on phones (same Wi‑Fi)

1. Open the app on your laptop, **Create room**, copy the link/`CODE`.
2. On phones, open `http://YOUR_LAN_IP:3000/room/CODE` (or use the copied link if reachable).
3. For PartyKit from other devices, set `NEXT_PUBLIC_PARTYKIT_HOST` to `YOUR_LAN_IP:1999` and restart, **or** deploy PartyKit and point at the cloud host.

> Tip: for a painless multi-phone test, deploy PartyKit first (below) and set `NEXT_PUBLIC_PARTYKIT_HOST` to that host even while developing the Next app locally.

## How to share a room

1. Host taps **Create room** → enters a display name → lands in the lobby.
2. Share the **4-character code** or **Copy link** / **Share**.
3. Friends open the link (or Home → Join + code) → enter names → wait in lobby.
4. Host can **Add RushBot**, then **Start game**.

## Game flow (v1)

1. **Lobby** — names, chips (start at 10), share code  
2. **Pick Category** — vote presets / custom; rematch-token holder can force-pick  
3. **Build Rushmore** — each player submits a ranked top 4  
4. **Rank & Rationale** — rank everyone else’s Mount + short why (optional RushBot suggest)  
5. **Reveal** — show Mounts, scores, rationales; chips awarded from peer rankings  
6. **BANK** — lite craps-style wagers resolved by one 2d6 roll:
   - Skip
   - Pot Shot (7+ even money)
   - Double Judge (8+ → rankings count double next Rushmore)
   - Rematch Token (10+ → pick next category)
   - Chip Heist (2 or 12 → steal from richest)
7. **BANK Results** → next Rushmore round

Late joiners can enter mid-session with starting chips and participate in the current/next phase when possible.

## Deploy

### A. Deploy PartyKit (realtime)

```bash
npx partykit login
npm run deploy:party
```

Note the printed host, e.g. `rushmore-bank.<you>.partykit.dev`.

### B. Deploy Next.js on Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Set env vars:
   - `NEXT_PUBLIC_PARTYKIT_HOST` = your PartyKit host (no protocol)
   - `OPENAI_API_KEY` = optional
4. Deploy.

No database required for v1 — room state lives in the PartyKit room storage for the session.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | PartyKit + Next (Turbopack) |
| `npm run build` | Production Next build |
| `npm run start` | Start Next production server |
| `npm run deploy:party` | Deploy PartyKit server |
| `npm run lint` | ESLint |

## TODOs / stretch

- [ ] Spectator mode + cleaner late-joiner “sit out this phase”  
- [ ] Push notifications / “nudge” idle players  
- [ ] Persistent leaderboards across nights  
- [ ] Richer BANK table (come-out / point, side pots)  
- [ ] Animated dice + sound bed  
- [ ] Custom avatars / team modes  
- [ ] Rename product (working title: Rushmore Bank)

## License

Private — all rights reserved unless otherwise noted.
