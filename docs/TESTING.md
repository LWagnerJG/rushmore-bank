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

## iOS keyboard e2e (`npm run test:ios-keyboard`)

Playwright WebKit against the real app (production build) and a local PartyServer, at 390×844 and 375×667. Desktop WebKit has no software keyboard, so `scripts/ios-keyboard-emulator.js` stands in for iOS: the layout viewport never shrinks, `visualViewport.height` shrinks by an iPhone-sized keyboard (380px / 304px incl. QuickType + accessory bar), and a focused field that is not fully visible above the keyboard is panned into view the way WebKit does.

Fields: draft pick (while other players lock picks mid-word and the turn arrives), home nickname, home room code, room-link nickname, custom topic.

| Check (per field, per size) | Result |
|---|---|
| Keyboard opens: field and its submit fully above it, no pan, `--app-h` unchanged, font-size ≥ 16px | Pass |
| Typing (15 chars): field top constant every frame (±1px), field + submit bottom ≤ `visualViewport.height`, `scrollY` 0, nothing above the field changes layout height/position, no enter-animation class re-added, no programmatic vertical scroll | Pass |
| One tap on Lock in / Stash it / stash chip submits with the keyboard open and keeps focus; Enter / Go submits; Continue / Join / Join game / topic Lock in submit on one tap | Pass |
| Keyboard closed: layout back to the exact pre-keyboard position, no leftover offset | Pass |

Local (three terminals):

```bash
npx wrangler dev --ip 127.0.0.1 --port 8787
NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:8787 npx next build && npx next start -p 3100
BASE_URL=http://127.0.0.1:3100 PARTY_HOST=127.0.0.1:8787 npm run test:ios-keyboard
```

`OUT_DIR` (default `/tmp/ios-keyboard`) gets `report.json` and screenshots with the keyboard painted in; `REPORT_ONLY=1` records failures without failing (before/after runs). CI: `.github/workflows/ios-keyboard-e2e.yml`.

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

## Per-tab guest IDs

Active guest player ids are stored in `sessionStorage` (`quarry:pid:session:${roomCode}`), so two tabs in the same browser join as distinct players instead of reconnecting as one. `localStorage` (`quarry:pid:last:${roomCode}`) only remembers the last id for an explicit Rejoin path — new tabs do not auto-reuse it.
