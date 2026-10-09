# Testing record — Quarry / Beans

## Pure rules (`npm test`)

- Snake draft completeness for N=3..10 (4 picks each; forward/reverse passes)
- Scoring: `earned = 20 + ai + 5*votes`
- Wager: `max = E + min(25,B)`; presets; protected balance
- Dice: any seven busts (incl. first roll); doubles double pot; add-sum / bust
- Topic bank ≥ 120
- Pull-out banking + settlement lap helpers
- Authoritative deadline identity across reconnects / server restart (PartyServer)

**Result:** run `npm test` on this branch (CI: Server & shared regression tests).

## PartyServer deploy

Realtime rooms run on **PartyServer** (Cloudflare Workers + SQLite Durable Objects), not hosted PartyKit.

| Step | Command / action |
|---|---|
| Login | `npx wrangler login` |
| Put judge secret | `npx wrangler secret put JUDGE_SECRET` |
| Deploy worker `beans-party` | `npx wrangler deploy` |
| Dry-run build check | `npx wrangler deploy --dry-run` |
| Point Next at new host | Vercel env `NEXT_PUBLIC_PARTYKIT_HOST=<worker>.<subdomain>.workers.dev` |
| Code default host | `DEFAULT_PARTYKIT_HOST` in `src/lib/party.ts` (placeholder until cutover) |

GitHub Actions: `.github/workflows/deploy-partyserver.yml` deploys on pushes that touch `party/**` when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set; otherwise the job **skips gracefully**.

Room data is short-lived — **no** PartyKit storage export/import.

## Programmatic multiplayer smoke (`npx tsx scripts/smoke-three.ts`)

Against local PartyServer (`wrangler dev`, default `127.0.0.1:8787`):

| Step | Result |
|---|---|
| 3 sockets join one room | Pass (when local stack up) |
| Topic vote → Draft (12 Lock Ins) | Pass |
| Review → Vote → AI fallback scores | Pass (45 each = 20+20+5) |
| Wager → Dice → Pull Out → ROUND_RESULTS | Pass |

Set `NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:8787` for local smokes.

## Multi-context browser smoke (local)

| Check | Result |
|---|---|
| Home + create room | Pass |
| 2 players in lobby | Pass |
| 3rd player via home Join | Failed once due to missing `joinError` state (500) — **fixed** |
| 3 sockets programmatic | Pass (authoritative path) |

## Production verification

| Check | Result |
|---|---|
| https://beans-game.vercel.app loads (roundacats alias OK) | After merge/deploy |
| PartyServer worker matches this branch | After `wrangler deploy` + `NEXT_PUBLIC_PARTYKIT_HOST` on Vercel |
| 2 sessions join one room | After cutover |
| Beans PWA name + dog/sunglasses icons / OG | Branding assets in `public/` + manifest |

## Timing notes

- Personal BANK (keep rolling until Bank/bust; everyone enters including W=0)
- Target session: 25–30 minutes (design), not hard-enforced
- Host failover window: 20s
- Draft pick **60s** + **5s** grace; review skim **0s** (straight into vote+judge); vote **45s** or until all voted; wager **45s**; dice no pre-roll countdown; idle bank **15s**; topic **no** timer

## AI

- Preferred: Gemini 3.6 Flash via `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) structured JSON at `/api/judge`
- Optional fallback: OpenAI `gpt-4o-mini` when Gemini unset but `OPENAI_API_KEY` present
- Without either key: fallback award 20 + label — stated plainly
- PartyServer calls `/api/judge` with `Authorization: Bearer $JUDGE_SECRET` and `X-Quarry-Judge: partyserver`

## Room session auto-rejoin

Membership (`code`, nickname, role, player id) is remembered in session+local storage for ~2h. Returning to the room URL (or foregrounding the tab) auto-rejoins / forces PartySocket reconnect without hunting for Rejoin. Soft-disconnect grace (~8s) still holds the mid-game seat; matching id cancels it on connect.

## Per-tab guest IDs

Active guest player ids are stored in `sessionStorage` (`quarry:pid:session:${roomCode}`), so two tabs in the same browser join as distinct players instead of reconnecting as one. `localStorage` (`quarry:pid:last:${roomCode}`) only remembers the last id for an explicit Rejoin path — new tabs do not auto-reuse it.
