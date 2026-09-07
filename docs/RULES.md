# Quarry — confirmed rules

Display name: **Quarry**. Tagline: *Draft four. Roll for more.* Currency: **Stones**.  
Production: https://roundacats.vercel.app

Tunable defaults live in `src/shared/rules.ts` (`RULES`). Do not quietly change confirmed behavior.

## Players

- 3–10 players (max 10). Individual competition; a “team” is one’s 4 picks.
- Nickname only. Rejoin via secure guest token (stable per-device room id), not nickname alone.
- Roster locks at Start; late joiners are spectators until the next game.
- Optional TV/spectator view (no seat).

## Phases

```
LOBBY → TOPIC_SELECTION → PREP → DRAFT (+ CORRECTION) → REVIEW
  → VOTING_AND_JUDGING → SCORE_REVEAL → WAGER_SELECTION
  → DICE (COOLDOWN / READY / COMMITTED / SETTLED)
  → ROUND_RESULTS → GAME_RESULTS
```

## Topics

- Random shortlist: **3** choices if 3–5 players, **2** if 6–10 (host override allowed).
- Scopes: sports / food / everyday / entertainment + host custom.
- ≥120 curated topics with scope tags (`src/shared/topics.ts`).
- Vote 20s or all-in; ties → server random among tied.
- 1 majority reroll per topic selection. No topic repeat in a game.
- Scope boundary shown before draft. Bank supports 40 distinct answers for 10 players.

## Draft

- 20s prep. Fair random seat order; starter rotates later topics.
- 4 snake passes for N=3..10. One **Lock In** per turn (server-validated).
- Pick clock 30s + short grace (5s); host pause / extend (+15s).
- Missed after grace → placeholder miss pick.
- **My Ideas**: private, persisted per device/room/player/topic; Use → field; Taken markers from public events; never in AI/spectator payloads.
- Host may mark Duplicate or Group Invalid → replacement turn (30s), resume cursor.
- Review/pitch 30s optional. Correction after ballots → invalidate + re-vote.
- After scores locked: **Void Topic** only (checkpoint restore).

## Scoring

```
earned = 20 + ai_award(0–40) + 5 × human_votes
```

- One private human vote for another’s full roster (no self-vote). Show counts, not voters.
- AI: one bounded request for all rosters; `topic_fit` 0–10, `pick_strength` 0–20, `roster_quality` 0–10; sum = `ai_award`; explanation ≤45 words.
- Prompt version: `quarry-judge-v1` (locked in `RULES.aiPromptVersion`).
- Fallback if AI fails: `20 + 20 + 5×votes`, labeled “Judge unavailable…”.
- Everyone earns Stones (even 0 votes). Start balance **0**.

## Wagers

```
max_wager = E + min(25, B)
protected = B + E − W
pot = W
```

- Defaults: Keep All / Half New / All New + custom.
- No response in 20s → W=0.
- Integers only; append-only ledger.

## Dice (exact)

- 2d6. Personal roll count. Outcomes affect **only** the roller.
- Rolls 1–2 (safe): seven → **+70**; else **+sum** (doubles add faces).
- Rolls 3+: seven → **bust** pot=0 exit; doubles → **double pot** (no add faces); else **+sum**.
- Rotate one throw each. **Pull Out** banks pot between rolls.
- Countdown 5s → unlock Roll (do not auto-throw). Idle 10s → auto bank pot.
- Atomic Roll vs Pull Out.
- Synchronized 3D scene with authoritative faces (all 36 outcomes). Fair backend RNG (rejection sampling).
- Soft budget 3 min; finish current lap; ≥3 laps before timed settlement for remaining players.
- Reduced-motion fallback. Prefer host sound.

### Worked path (tests)

Protected **95**. Pot path: `105 → 175` (safe seven) → `187` (safe 6+6) → `374` (dangerous doubles).  
Banking that pot yields **95 + 374 = 469** total Stones — **469 is the banked total, not the next dice pot**.  
A following non-seven face-sum on the pot (without banking) adds normally (e.g. 5+6 → 385).

## Party Mode

- Off by default; host may change between topics.
- Winner may give one optional sip (ties share one prompt).
- Bust → one-sip to that player only.
- Done/Pass; **no score effect**.

## Superseded (do not implement)

Bets on roster winning, individual-pick side bets, quarter-step multipliers, 4× cap, shared pots/busts, old 50/50 scoring label.

## Architecture notes

- Authoritative durable room state in PartyKit storage (not localStorage authority).
- Server timers via PartyKit `storage.setAlarm` so deadlines survive host tab sleep.
- Idempotent actions + phase revisions + append-only ledger.
- Host failover ~20s when host disconnects.
