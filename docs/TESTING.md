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

Realtime rooms run on **PartyServer** (Cloudflare Workers + SQLite Durable Objects).

| Step | Command / action |
|---|---|
| Login | `npx wrangler login` |
| Put judge secret | `npx wrangler secret put JUDGE_SECRET` |
| Deploy worker `beans-party` | `npx wrangler deploy` |
| Dry-run build check | `npx wrangler deploy --dry-run` |
| Point Next at worker | Vercel env `NEXT_PUBLIC_PARTYKIT_HOST=<worker>.<subdomain>.workers.dev` |
| Code default host | `DEFAULT_PARTYKIT_HOST` in `src/lib/party.ts` |

GitHub Actions: `.github/workflows/deploy-partyserver.yml` deploys on pushes that touch `party/**` when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set; otherwise the job **skips gracefully**.

Room data is short-lived.

## Programmatic multiplayer smoke

Host via `PARTY_HOST` or `NEXT_PUBLIC_PARTYKIT_HOST` (default: `beans-party.beans-lwagner.workers.dev`).

### Three humans (`npm run smoke:three`)

| Step | Result |
|---|---|
| 3 sockets join one room | Pass (waits for roster, not bare LOBBY) |
| Topic vote → Draft (12 Lock Ins) | Pass |
| Vote → AI fallback scores → Bank the Beans | Pass |
| Wager → Dice → Pull Out → ROUND_RESULTS | Pass |

### Bots e2e (`npm run smoke:bots`)

Spawns admin bots (`fast: true` shortens tap delays), auto-plays the human seat, and asserts picks are real answers (not `Missed pick`).

| Env | Purpose |
|---|---|
| `PARTY_HOST` | Target PartyServer host (no protocol) |
| `SMOKE_UNTIL=round_results\|game_results` | Stop after one round or full match (default `game_results`) |
| `SMOKE_BOTS` | Bot count (default 3) |

CI: `.github/workflows/smoke-bots.yml` runs one round against local `wrangler dev` on PRs; scheduled/manual runs a full game against prod.

Local: `PARTY_HOST=127.0.0.1:8787 SMOKE_UNTIL=round_results npm run smoke:bots`

**Note:** A draft with “0 picks” while bots are seated is usually the *human* seat’s turn — bots only lock in on bot turns (not a server stall).

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
| https://beans-game.vercel.app loads (roundacats alias OK) | Pass |
| PartyServer worker matches this branch | After `wrangler deploy` + `NEXT_PUBLIC_PARTYKIT_HOST` on Vercel |
| 2 sessions join one room | Pass |
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

A new tab (or a relaunched PWA) has no session membership, so it shows the join form. If local storage still holds a player membership for the room (`rejoinOffer`), the form is prefilled with that nickname, and Join game under that nickname reloads onto the old seat's id. First-time visitors get an empty form; the join form renders only after hydration.

## Per-tab guest IDs

Active guest player ids are stored in `sessionStorage` (`quarry:pid:session:${roomCode}`), so two tabs in the same browser join as distinct players instead of reconnecting as one. `localStorage` (`quarry:pid:last:${roomCode}`) remembers the last id used, including ids minted by visits that never joined, so it is not proof of a seat — new tabs do not auto-reuse it.
