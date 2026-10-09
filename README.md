# Beans

**Draft four. Bank beans.** — mobile-first party game. Currency: **beans** (protocol fields still named `stones`).

Production: [https://beans-game.vercel.app](https://beans-game.vercel.app) (PWA name **Beans**). Old host [https://roundacats.vercel.app](https://roundacats.vercel.app) remains a working alias.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4
- PartyServer on Cloudflare Workers (Durable Objects + storage alarms) via `wrangler`
- Optional AI roster judging via Gemini (`GEMINI_API_KEY`) or OpenAI at `/api/judge`
- three.js synchronized 3D dice

## Local development

Requires **Node 22+** (wrangler).

```bash
npm install
cp .env.example .env.local
npm run dev
```

- App: http://localhost:3000
- PartyServer (wrangler): `ws://127.0.0.1:8787` — set `NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:8787`

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PARTYKIT_HOST` | No | PartyServer host, no protocol (local or `*.workers.dev`) |
| `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | No | Preferred AI judge (Gemini 3.6 Flash) |
| `OPENAI_API_KEY` | No | Optional AI judge fallback |
| `JUDGE_SECRET` | No | Shared secret so only PartyServer can call paid `/api/judge` |

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | PartyServer (`wrangler dev`) + Next (Turbopack) |
| `npm run dev:party` | `wrangler dev` only |
| `npm run deploy:party` | `wrangler deploy` to your Cloudflare account |
| `npm run build` | Production Next build |
| `npm test` | Pure rules unit tests (Vitest) |
| `npm run lint` | ESLint |

## Deploy PartyServer (cutover)

Hosted PartyKit (`*.partykit.dev`) is shutting down. The realtime server lives in `party/server.ts` and deploys as worker **`beans-party`** (`wrangler.jsonc`).

1. **Login** (once): `npx wrangler login`
2. **Secret** (once per account): `npx wrangler secret put JUDGE_SECRET` — same value as Vercel `JUDGE_SECRET`
3. **Deploy**: `npx wrangler deploy` (or `npm run deploy:party`)
4. **Note the host** from the deploy output, e.g. `beans-party.<subdomain>.workers.dev`
5. **Point the Next app** at that host:
   - Set Vercel env `NEXT_PUBLIC_PARTYKIT_HOST` to the workers.dev host (no protocol)
   - Optionally replace the placeholder in `src/lib/party.ts` (`DEFAULT_PARTYKIT_HOST`)
6. **CI**: GitHub Actions workflow `Deploy PartyServer` uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. If those secrets are missing, the job **skips** (exit 0) instead of failing.

`JUDGE_URL` is a wrangler `vars` entry (`https://beans-game.vercel.app`). Room storage is short-lived — no export/import from PartyKit.

Full notes: [`docs/TESTING.md`](docs/TESTING.md).

## How to play (short)

1. Create / Join with a nickname. Share code, link, or QR.
2. Snake draft 4 answers (**Lock in**). Type your own; park picks in your **Stash** while waiting. Board stays on screen.
3. Vote for another’s roster; AI judges all. Everyone earns beans.
4. Slider: how many beans to risk. Then personal **bank** turns — keep rolling until Bank or bust (**any 7**, including first roll). Waiting players watch.
5. Most banked beans wins.

Full rules: [`docs/RULES.md`](docs/RULES.md).

## License

Private — all rights reserved unless otherwise noted.
