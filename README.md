# Beans

**Draft four. Bank beans.** — mobile-first party game. Currency: **beans** (protocol fields still named `stones`).

Production today: [https://roundacats.vercel.app](https://roundacats.vercel.app) (Quarry on `main`). This branch is a Fudge polish candidate.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PartyKit for durable realtime rooms + server alarms
- Optional AI roster judging via Gemini (`GEMINI_API_KEY`) or OpenAI at `/api/judge`
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
| `NEXT_PUBLIC_PARTYKIT_HOST` | No | Override PartyKit host (no protocol) |
| `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | No | Preferred AI judge (Gemini 3.5 Flash) |
| `OPENAI_API_KEY` | No | Optional AI judge fallback |
| `JUDGE_SECRET` | No | Shared secret so only PartyKit can call paid `/api/judge` |

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | PartyKit + Next (Turbopack) |
| `npm run build` | Production Next build |
| `npm test` | Pure rules unit tests (Vitest) |
| `npm run deploy:party` | Deploy PartyKit server |
| `npm run lint` | ESLint |

## How to play (short)

1. Create / Join with a nickname. Share code, link, or QR.
2. Snake draft 4 answers (**Lock in**). Type your own; save private ideas while waiting. Board stays on screen.
3. Vote for another’s roster; AI judges all. Everyone earns beans.
4. Slider: how many beans to risk. Then personal **bank** turns — keep rolling until Bank or bust (**any 7**, including first roll). Waiting players watch.
5. Most banked beans wins.

Full rules: [`docs/RULES.md`](docs/RULES.md).

## License

Private — all rights reserved unless otherwise noted.
