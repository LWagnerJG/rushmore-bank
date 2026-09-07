# Beans — test preview

**Draft four. Bank beans.** — mobile-first party game. 2–10 players. Currency: **beans**.

> Test only. Production stays at [roundacats.vercel.app](https://roundacats.vercel.app). Fudge’s release is PR #12; the Codex follow-up targets that test branch. Do not merge to main before Luke and Brynna approve.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PartyKit for durable realtime rooms + server alarms (deadlines survive host tab sleep)
- Optional AI roster judging via Gemini (`GEMINI_API_KEY`) or OpenAI (`OPENAI_API_KEY`) at `/api/judge`; uniform neutral fallback if unavailable
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
| `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | No | Preferred AI judge |
| `GEMINI_MODEL` | No | Supported Gemini model ID; defaults to `gemini-3.5-flash` |
| `OPENAI_API_KEY` | No | Optional AI judge fallback if Gemini unset |
| `JUDGE_SECRET` | For paid AI | Matching secret on the frontend server and PartyKit; required for paid `/api/judge` calls |
| `NEXT_PUBLIC_APP_ENV` | For a separate test project | Set to `test`; a test backend is required |

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
4. AI judges everyone. With 3+ players, private votes add beans; with 2, AI-only scoring skips the ballot. Everyone earns beans.
5. Wager into a personal pot. Rotating personal dice: first 2 rolls safe; then 7 busts that player only; doubles double pot. **Bank** banks.
6. Most banked Beans wins.

Full rules: [`docs/RULES.md`](docs/RULES.md). Build notes: [`/build-notes`](https://roundacats.vercel.app/build-notes).

## Deploy (test only)

Use the separate frontend/backend setup in `docs/BEANS_TEST_RELEASE.md`. Do not run the production PartyKit deploy script from this test branch.

Beans uses a coral bean character on the favicon, home-screen icons, share image, and in-app brand mark.

For isolated testing and promotion, see [`docs/BEANS_TEST_RELEASE.md`](docs/BEANS_TEST_RELEASE.md). Do not point the test frontend at production PartyKit.

## License

Private — all rights reserved unless otherwise noted.

