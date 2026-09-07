# Beans

**Draft four. Bank beans.** — mobile-first party game. 2–10 players. Currency: **beans**.

Release target: [roundacats.vercel.app](https://roundacats.vercel.app). Publish both the Next frontend and the PartyKit server after the release checks pass.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PartyKit for durable realtime rooms + server alarms (deadlines survive host tab sleep)
- Optional AI roster judging via Gemini (`GEMINI_API_KEY`) or OpenAI (`OPENAI_API_KEY`) at `/api/judge`; uniform neutral fallback if unavailable
- Synchronized SVG dice projected from shared 3D geometry (no WebGL required)

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
2. Spin topics → vote one. Snake draft 4 answers (**Lock pick**). Private **My queue** while waiting.
3. Host can remove duplicate/invalid → replacement turn.
4. AI judges everyone. With 3+ players, private votes add beans; with 2, AI-only scoring skips the ballot. Everyone earns beans.
5. Slide from 0 through your full balance to wager. Everyone enters BANK, including zero wagers. One roll, then pass; first 2 personal rolls are safe, then 7 busts only that player and doubles double their pot. Bank to leave; everyone returns next topic.
6. Most banked Beans wins.

Full rules: [`docs/RULES.md`](docs/RULES.md). Build notes: [`/build-notes`](https://roundacats.vercel.app/build-notes).

## Deploy

The `main` branch deploys the frontend through Vercel and the backend through `.github/workflows/deploy-partykit.yml`. The backend workflow requires `PARTYKIT_TOKEN` and `PARTYKIT_LOGIN` repository secrets. Missing credentials must be fixed before promoting a release with server changes.

The expected backend health response at `/parties/main/CHECK` includes `release: beans-roundrobin-v1`. Keep the existing Gemini key and matching `JUDGE_SECRET` on Vercel and PartyKit. Suggestions use the same secret and Gemini configuration; the scoring route is unchanged.

For local browser checks, build with `NEXT_PUBLIC_APP_ENV=development NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999`, install Playwright, then run `node scripts/browser-smoke.mjs`. The script only runs local servers and never calls paid AI.

Beans uses a coral bean character on the favicon, home-screen icons, share image, and in-app brand mark.

For isolated testing and promotion, see [`docs/BEANS_TEST_RELEASE.md`](docs/BEANS_TEST_RELEASE.md). Do not point the test frontend at production PartyKit.

## License

Private — all rights reserved unless otherwise noted.

