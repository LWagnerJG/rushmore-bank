# Beans (TEST branch)

**Draft four. Roll for more.** — mobile-first party game. Currency: **beans**.

> **TEST ONLY** — compare against production Quarry at
> [https://roundacats.vercel.app](https://roundacats.vercel.app).
> Do not merge this branch to `main` until Luke picks. See
> [`docs/BEANS_TEST_RELEASE.md`](docs/BEANS_TEST_RELEASE.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PartyKit for durable realtime rooms + server alarms (deadlines survive host tab sleep)
- Optional AI roster judging via Gemini `gemini-3.5-flash` (`GEMINI_API_KEY`) or OpenAI (`OPENAI_API_KEY`) at `/api/judge`; heuristic fallback if unset
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
| `NEXT_PUBLIC_PARTYKIT_HOST` | Yes for test/preview | PartyKit host (no protocol). Test/preview refuse production host fallback. |
| `NEXT_PUBLIC_APP_ENV` | For test deploys | Set `test` (or `preview`) on the Beans test frontend |
| `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | No | Preferred AI judge (`gemini-3.5-flash`) |
| `OPENAI_API_KEY` | No | Optional AI judge fallback if Gemini unset |
| `JUDGE_SECRET` | Yes when a paid key is set | Shared secret so only PartyKit can call paid `/api/judge` |

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | PartyKit + Next (Turbopack) |
| `npm run build` | Production Next build |
| `npm test` | Pure rules unit tests (Vitest) |
| `npm run deploy:party` | Deploy PartyKit server |
| `npm run lint` | ESLint |

## How to play (short)

1. Create Game / Join with a nickname. Share code, link, or QR. **2–10** players.
2. Spin topics → vote one. Snake draft 4 answers (**Lock In**). Private **My Ideas** while waiting.
3. Host can remove duplicate/invalid → replacement turn.
4. Vote for another’s roster; AI judges all. Everyone earns beans.
5. Wager into a personal pot. Rotating personal dice: first 2 rolls safe; then 7 busts that player only; doubles double pot. **Bank beans** / Pull Out banks.
6. Most banked beans wins.

Internal protocol still uses `stones` field names for compatibility; UI says beans.

Full rules: [`docs/RULES.md`](docs/RULES.md). Build notes: `/build-notes` on the deployed test URL.

## Deploy (test only)

1. Deploy a **separate** PartyKit project via `partykit.test.json` — note that host.
2. Point a separate Vercel project (requested alias `roundacats-test.vercel.app`) at this branch.
3. Set `NEXT_PUBLIC_APP_ENV=test`, `NEXT_PUBLIC_PARTYKIT_HOST=<test-host>`, matching `JUDGE_SECRET` / `JUDGE_URL`, plus `GEMINI_API_KEY`.

Do **not** deploy this branch to production alias `roundacats.vercel.app`.

## License

Private — all rights reserved unless otherwise noted.
