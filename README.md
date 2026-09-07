# Quarry

**Draft four. Roll for more.** — mobile-first party game. Currency: **Stones**.

Play at [https://roundacats.vercel.app](https://roundacats.vercel.app).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PartyKit for durable realtime rooms + server alarms (deadlines survive host tab sleep)
- Optional `OPENAI_API_KEY` for AI roster judging (`/api/judge`); heuristic fallback if unset
- three.js synchronized 3D dice

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

- App: http://localhost:3000
- PartyKit: `ws://127.0.0.1:1999`

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PARTYKIT_HOST` | No | Override PartyKit host (no protocol). Default production: `rushmore-bank.lwagnerjg.partykit.dev` |
| `OPENAI_API_KEY` | No | AI judge; fallback scoring if missing |

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | PartyKit + Next (Turbopack) |
| `npm run build` | Production Next build |
| `npm test` | Pure rules unit tests (Vitest) |
| `npm run deploy:party` | Deploy PartyKit server |
| `npm run lint` | ESLint |

## How to play (short)

1. Create Game / Join with a nickname. Share code, link, or QR.
2. Spin topics → vote one. Snake draft 4 answers (**Lock In**). Private **My Ideas** while waiting.
3. Host can remove duplicate/invalid → replacement turn.
4. Vote for another’s roster; AI judges all. Everyone earns Stones.
5. Wager into a personal pot. Rotating personal dice: first 2 rolls safe; then 7 busts that player only; doubles double pot. **Pull Out** banks.
6. Most banked Stones wins.

Full rules: [`docs/RULES.md`](docs/RULES.md). Build notes: [`/build-notes`](https://roundacats.vercel.app/build-notes).

## Deploy

1. `npm run deploy:party` — note PartyKit host.
2. Vercel project **`roundacats`** (domain `roundacats.vercel.app`) auto-deploys from GitHub `LWagnerJG/rushmore-bank`.
3. Set `NEXT_PUBLIC_PARTYKIT_HOST` if not using the baked default; set `OPENAI_API_KEY` for AI.

Dog mascot remains favicon / apple-touch / OG / PWA icons. In-app brand mark uses four stone tiles + **Quarry**.

## License

Private — all rights reserved unless otherwise noted.
