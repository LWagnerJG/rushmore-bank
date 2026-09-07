# Beans — confirmed rules

Display name: **Beans**. Tagline: *Draft four. Bank beans.* Currency: **beans**.  
Production: https://roundacats.vercel.app

Tunable defaults live in `src/shared/rules.ts` (`RULES`). Do not quietly change confirmed behavior.

## Players

- 2–10 players (max 10). Individual competition; a “team” is one’s 4 picks.
- Nickname only. Rejoin via secure guest token (per-tab room id; closing a tab or switching to the installed app may require explicit seat recovery), not nickname alone.
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

- Random shortlist: **3** choices if 2–5 players, **2** if 6–10 (host override allowed).
- Scopes: sports / food / everyday / entertainment + host custom.
- ≥120 curated topics with scope tags (`src/shared/topics.ts`).
- Vote 20s or all-in; ties → server random among tied.
- 1 host-triggered reroll per topic selection after the group agrees. No topic repeat in a game.
- Scope boundary shown before draft. Ten players need 40 distinct valid answers: review narrow prompts before using them with large groups.

## Draft

- 20s prep. Random seat order; starter rotates later topics.
- 4 snake passes for N=2..10. One **Lock pick** per turn (server-validated).
- Pick clock 30s + short grace (5s); host pause / extend (+15s).
- Missed after grace → placeholder miss pick.
- **My queue**: private, saved per device/room/player/topic. Available answers can be searched and queued, and players can type their own. Taken answers are removed from Available and marked in the queue. The four-row board shows the snake order and current pick.
- Suggestions come from a starter catalog or one bounded, authenticated Gemini request per topic. Failure leaves manual entry available. Suggestions do not affect the judge.
- Host may mark Duplicate or Group Invalid → replacement turn (30s), resume cursor.
- Review/pitch 30s optional. Correction after ballots → invalidate + re-vote.
- After scores locked: **Discard round** only (checkpoint restore).

## Scoring

```
earned = 20 + ai_award(0–40) + 5 × human_votes
```

- With 3–10 players: one private vote for another’s full roster (no self-vote). Show counts, not voters.
- With 2 players: no human ballots or vote bonus; earned = 20 + AI award. Advance as soon as the judge finishes. The locked starting roster size determines this, even if someone disconnects.
- Two-player AI failure gives 40 beans each; the game proceeds to wagers.
- AI: one bounded request for all rosters; `topic_fit` 0–10, `pick_strength` 0–20, `roster_quality` 0–10; sum = `ai_award`; explanation ≤45 words.
- Prompt version: `quarry-judge-v1` (locked in `RULES.aiPromptVersion`).
- Fallback if AI fails: `20 + 20 + 5×votes`, labeled “Judge unavailable…”.
- Everyone earns beans (even 0 votes). Start balance **0**.

## Wagers

```
max_wager = E + B
protected = B + E − W
pot = W
```

- Slider and visible number field: 0 through the full current balance. None / Half / All in shortcuts. Players must lock the amount.
- Every player enters dice play, including a zero wager. All un-wagered beans remain protected.
- No response in 20s → W=0.
- Integers only; append-only ledger.

## Dice (exact)

- 2d6. Personal roll count. Outcomes affect **only** the roller.
- Rolls 1–2 (safe): seven → **+70**; else **+sum** (doubles add faces).
- Rolls 3+: seven → **bust** pot=0 exit; doubles → **double pot** (no add faces); else **+sum**.
- One throw per active player, then pass around the table again. **Bank** keeps the pot and exits this dice round. Even a zero pot can bank or time out.
- Each new topic starts a fresh BANK round: everyone returns, current winnings carry forward, and personal safe-roll counts reset.
- Countdown 5s → unlock Roll (do not auto-throw). Idle 10s → auto bank pot.
- Atomic Roll vs Bank.
- Synchronized 3D scene with authoritative faces (all 36 outcomes). Fair backend RNG (rejection sampling).
- The dice round ends when everyone banks or busts. No global timer forces the table to finish.
- Pip dice use six-face CSS cubes, a shared seed and timestamps. Reduced motion shows a still roll state before the result. Sound is optional, host only.

### Worked path (tests)

Protected **95**. Pot path: `105 → 175` (safe seven) → `187` (safe 6+6) → `374` (dangerous doubles).  
Banking that pot yields **95 + 374 = 469** total beans — **469 is the banked total, not the next dice pot**.  
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
