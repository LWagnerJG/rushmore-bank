# Testing record — Quarry

## Pure rules (`npm test`)

- Snake draft completeness for N=3..10 (4 picks each; forward/reverse passes)
- Scoring: `earned = 20 + ai + 5*votes`
- Wager: `max = E + min(25,B)`; presets; protected balance
- Dice: `105 → 175 → 187 → 374` then sum / bust
- Topic bank ≥ 120

## Multi-context browser smoke (local)

| Check | Result |
|---|---|
| 3 independent browser contexts join one room | Pending / run before merge |
| Host start → topic vote → draft Lock In | Pending |
| Vote + wager + Roll / Pull Out sync | Pending |
| 6 / 10 player stress (if feasible) | Optional |

## Production verification

| Check | Result |
|---|---|
| https://roundacats.vercel.app loads | After deploy |
| 2 sessions join one room via PartyKit | After deploy |
| Dog favicon / apple-touch / OG intact | Must remain |

## Timing notes (measured)

- Soft dice budget: 3 minutes (`RULES.diceSoftBudgetMs`)
- Target session: 25–30 minutes (design), not enforced hard
- Host failover window: 20s

## AI

- With key: OpenAI `gpt-4o-mini` structured judgments
- Without key: fallback award 20 + label — state plainly in handoff
