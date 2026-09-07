# Beans — confirmed rules

Display name: **Beans**. Tagline: *Draft four. Bank beans.* Currency: **beans** (internal field names remain `stones`).  
Production (until promote): https://roundacats.vercel.app

Tunable defaults live in `src/shared/rules.ts` (`RULES`). Do not quietly change confirmed behavior.

## Players

- **2–10** players (max 10). Individual competition; a “team” is one’s 4 picks.
- Nickname only. Rejoin via secure guest token (stable per-device room id), not nickname alone.
- Roster locks at Start; late joiners are spectators until the next game.
- Optional TV/spectator view (no seat).

## Phases

```
LOBBY → TOPIC_SELECTION → PREP → DRAFT (+ CORRECTION) → REVIEW
  → VOTING_AND_JUDGING → SCORE_REVEAL → WAGER_SELECTION
  → DICE / BANK (COOLDOWN / READY / COMMITTED / SETTLED)
  → ROUND_RESULTS → GAME_RESULTS
```

## Topics

- Random shortlist: **3** choices if 2–5 players, **2** if 6–10 (host override allowed).
- Scopes: sports / food / everyday / entertainment + host custom.
- ≥120 curated topics with scope tags (`src/shared/topics.ts`).
- Vote 20s or all-in; ties → server random among tied.
- 1 majority reroll per topic selection. No topic repeat in a game.
- Scope boundary shown before draft.
- Topic rounds played: **3** with 2–5 players; **2** with 6–10.

## Draft

- 20s prep. Fair random seat order; starter rotates later topics.
- 4 snake passes for N=2..10. One **Lock In** per turn (server-validated).
- Pick clock 30s + short grace (5s); host pause / extend (+15s).
- Missed after grace → placeholder miss pick.
- **My Ideas**: private, persisted per device/room/player/topic; Use → field; Taken markers from public events; never in AI/spectator payloads.
- Host may mark Duplicate or Group Invalid → replacement turn (30s), resume cursor.
- Review/pitch 30s optional.
- Fantasy-style shared draft board (UI): whose turn / you’re next / snake order.

## Scoring

```
earned = 20 + ai_award(0–40) + 5 × human_votes
```

- One private human vote for another’s full roster (no self-vote). Show counts, not voters.
- AI: Gemini-first (`gemini-3.5-flash`); OpenAI fallback; uniform neutral if no key.
- Prompt version: `quarry-judge-v1` (locked in `RULES.aiPromptVersion`).
- Everyone earns beans (even 0 votes). Start balance **0**.

## Wagers

```
max_wager = E + min(25, B)
protected = B + E − W
pot = W
```

- UX: slider 0…max with protected vs at-risk; presets Keep all / Half new / All new.
- No response in 20s → W=0.
- Integers only; append-only ledger.

## Bank / Dice (exact)

- After wagers, **each active player** gets a **personal BANK mini-round** in seat order:
  safe rolls → risk rolls → Bank (or bust) before the next player starts.
- 2d6. Personal roll count. Outcomes affect **only** the roller.
- Rolls 1–2 (safe): seven → **+70**; else **+sum** (doubles add faces).
- Rolls 3+: seven → **bust** pot=0 exit; doubles → **double pot** (no add faces); else **+sum**.
- **Bank** locks pot between rolls. Waiting players may Bank during another’s cooldown/animation without clearing alarms or advancing the seat.
- Countdown 5s → unlock Roll (do not auto-throw). Idle 10s → auto bank pot.
- Atomic Roll vs Bank.
- Synchronized 3D scene with authoritative faces (all 36 outcomes).
- Soft budget 3 min; remaining pots auto-banked at the next bank boundary.
- Reduced-motion fallback. Prefer host sound.

### Worked path (tests)

Protected **95**. Pot path: `105 → 175` (safe seven) → `187` (safe 6+6) → `374` (dangerous doubles).  
Banking that pot yields **95 + 374 = 469** total beans — **469 is the banked total, not the next dice pot**.

## Party Mode

- Off by default; host may change between topics.
- Winner may give one optional sip (ties share one prompt).
- Bust → one-sip to that player only.
- Done/Pass; **no score effect**.

## Superseded (do not implement)

Bets on roster winning, individual-pick side bets, quarter-step multipliers, 4× cap, shared pots/busts, rotating single-throw “one roll each then pass” as the primary bank feel (replaced by per-player BANK mini-rounds).

## Architecture notes

- Authoritative durable room state in PartyKit storage.
- Server timers via PartyKit `storage.setAlarm`.
- Idempotent actions + phase revisions + append-only ledger.
- Host failover ~20s when host disconnects.
- Waiting-player Bank must **not** bump `phaseRevision` (pending dice alarms own it).
