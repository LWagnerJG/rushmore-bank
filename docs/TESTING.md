# Testing record — Quarry

## Pure rules (`npm test`)

- Snake draft completeness for N=3..10 (4 picks each; forward/reverse passes)
- Scoring: `earned = 20 + ai + 5*votes`
- Wager: `max = E + min(25,B)`; presets; protected balance
- Dice: `105 → 175 → 187 → 374` then sum / bust
- Topic bank ≥ 120
- Pull-out banking + settlement lap helpers

**Result (this branch):** 13 tests passed.

## Programmatic multiplayer smoke (`npx tsx scripts/smoke-three.ts`)

Against local PartyKit `127.0.0.1:1999`:

| Step | Result |
|---|---|
| 3 sockets join one room | Pass |
| Topic vote → Prep → Draft (12 Lock Ins) | Pass |
| Review → Vote → AI fallback scores | Pass (45 each = 20+20+5) |
| Wager → Dice → Pull Out → ROUND_RESULTS | Pass |

Room `SMK3` measured ~19s for one compressed topic (host skip prep/review; pull-out path).

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
| PartyKit protocol matches this branch | **Requires `npx partykit deploy`** (agent lacked PartyKit login/token) |
| 2 sessions join one room | After PartyKit redeploy |
| Dog favicon / apple-touch / OG intact | Preserved in repo |

## Timing notes

- No global dice cutoff: end when everyone banks or busts. Check that an idle zero-wager player can exit.
- Target session: 25–30 minutes (design), not hard-enforced
- Host failover window: 20s
- Dice decision countdown 5s; idle bank 10s

## AI

- Preferred: Gemini 2.0 Flash via `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) structured JSON at `/api/judge`
- Optional fallback: OpenAI `gpt-4o-mini` when Gemini unset but `OPENAI_API_KEY` present
- Without either key: fallback award 20 + label — stated plainly

## Per-tab guest IDs

Active guest player ids are stored in `sessionStorage` (`quarry:pid:session:${roomCode}`), so two tabs in the same browser join as distinct players instead of reconnecting as one. `localStorage` (`quarry:pid:last:${roomCode}`) only remembers the last id for an explicit Rejoin path — new tabs do not auto-reuse it.


## Beans branch verification (2026-09-07)

The original reports above belong to the upstream changes. For the Beans branch, run `node --experimental-vm-modules scripts/verify-beans.mjs` on Node 24. Local actual-handler regressions passed for two-player complete games, provider routing with mocked HTTP, group vote retention, waiting banking/alarms, correction resumption and timeouts, privacy, judge authentication, and preview isolation.

Babel parsed/transformed the TypeScript/TSX sources. Local npm installation returned an environment 403; no local Next build, lint, Vitest or real-browser play-test is claimed. Check the current PR commit's CI for dependency-backed results and follow [the test release checklist](BEANS_TEST_RELEASE.md) before marking multiplayer ready.
