# Testing record — Quarry

## Pure rules (`npm test`)

- Snake draft completeness for N=3..10 (4 picks each; forward/reverse passes)
- Scoring: `earned = 20 + ai + 5*votes`
- Wager: `max = E + min(25,B)`; presets; protected balance
- Dice: any seven busts (incl. first roll); doubles double pot; add-sum / bust
- Topic bank ≥ 120
- Pull-out banking + settlement lap helpers

**Result (this branch):** 13 tests passed.

## Programmatic multiplayer smoke (`npx tsx scripts/smoke-three.ts`)

Against local PartyKit `127.0.0.1:1999`:

| Step | Result |
|---|---|
| 3 sockets join one room | Pass |
| Topic vote → Draft (12 Lock Ins) | Pass |
| Review → Vote → AI fallback scores | Pass (45 each = 20+20+5) |
| Wager → Dice → Pull Out → ROUND_RESULTS | Pass |

Room `SMK3` measured ~19s for one compressed topic (host skip review; pull-out path).

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
| https://roundacats.vercel.app loads | After merge/deploy |
| PartyKit protocol matches this branch | **Blocked** — GitHub Actions `Deploy PartyKit` fails: missing `PARTYKIT_TOKEN` / `PARTYKIT_LOGIN` secrets. Run `npx partykit token generate`, add both repo secrets, then re-run the workflow (or `npx partykit deploy` locally). |
| 2 sessions join one room | After PartyKit redeploy |
| Dog favicon / apple-touch / OG intact | Preserved in repo |

## Timing notes

- Personal BANK (keep rolling until Bank/bust; everyone enters including W=0)
- Target session: 25–30 minutes (design), not hard-enforced
- Host failover window: 20s
- Draft pick **60s** + **5s** grace; review **5s** (auto-start vote); vote **45s** or until all voted; wager **20s**; dice no pre-roll countdown; idle bank **15s**; topic **no** timer
- PartyKit redeploy still **blocked** on missing `PARTYKIT_TOKEN` / `PARTYKIT_LOGIN` — server timers (review/vote) won’t update in prod until secrets are set and the workflow is re-run (or `npx partykit deploy` locally).

## AI

- Preferred: Gemini 2.0 Flash via `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) structured JSON at `/api/judge`
- Optional fallback: OpenAI `gpt-4o-mini` when Gemini unset but `OPENAI_API_KEY` present
- Without either key: fallback award 20 + label — stated plainly

## Per-tab guest IDs

Active guest player ids are stored in `sessionStorage` (`quarry:pid:session:${roomCode}`), so two tabs in the same browser join as distinct players instead of reconnecting as one. `localStorage` (`quarry:pid:last:${roomCode}`) only remembers the last id for an explicit Rejoin path — new tabs do not auto-reuse it.
