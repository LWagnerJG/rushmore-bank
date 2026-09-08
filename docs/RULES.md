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
LOBBY → TOPIC_SELECTION → DRAFT (+ CORRECTION) → REVIEW
  → VOTING_AND_JUDGING → SCORE_REVEAL → WAGER_SELECTION
  → DICE / BANK (COOLDOWN / READY / COMMITTED / SETTLED)
  → ROUND_RESULTS → GAME_RESULTS
```

## Topics

- Random shortlist: always **4** choices. Anyone can **reroll** the set as needed.
- Scopes: sports / food / everyday / entertainment + host custom.
- ≥120 curated topics with scope tags (`src/shared/topics.ts`).
- **No topic timer** — players pick calmly; advances when every connected player has voted (or host locks a custom topic). Ties → server random among tied.
- No topic repeat in a game.
- Scope boundary shown before draft.
- Topic rounds played: **3** with 2–5 players; **2** with 6–10.

## Draft

- Topic lock goes **straight into draft** (no prep countdown).
- Fair random seat order; starter rotates later topics.
- 4 snake passes for N=2..10. One **Lock In** per turn (server-validated). Free-text answers only (no shared suggestion catalog).
- Pick clock 30s + short grace (5s); host pause / extend (+15s).
- Missed after grace → placeholder miss pick.
- **Ideas**: private queue + type field in one embedded surface; Save idea while waiting; Lock in on your turn; tap a queued idea to lock instantly when up. Never in AI/spectator payloads.
- Host may mark Duplicate or Group Invalid → replacement turn (30s), resume cursor.
- Review/pitch 30s optional.
- Fantasy-style shared draft board always visible during draft (UI): whose turn / you’re next / snake order.

## Scoring

```
earned = 20 + ai_award(0–40) + 5 × human_votes
```

- One private human vote for another’s full roster (no self-vote). Show counts, not voters.
- AI: Gemini-first (`gemini-3.5-flash` with retry/backoff + flash model fallback); OpenAI fallback; uniform neutral if no key. Player-facing notice never includes HTTP codes.
- Prompt version: `quarry-judge-v1` (locked in `RULES.aiPromptVersion`).
- Everyone earns beans (even 0 votes). Start balance **0**.

## Wagers

```
max_wager = E + B
protected = B + E − W
pot = W
```

- UX: one risk number + slider + Keep/Half/All + Lock-in CTA.
- No response in 20s → W=0. Zero-wager players still enter the dice circuit.
- Integers only; append-only ledger.

## Bank / Dice (exact)

- After wagers, **every seated player** enters dice — including W=0.
- **Personal continuous turn**: when you’re up, keep rolling until you **Bank** or **bust**. Do **not** pass after each roll. After bank/bust, the next active seat gets their own continuous turn. Waiting players watch.
- Personal safe counts reset each topic. First **2** personal rolls are safe.
- 2d6. Outcomes affect **only** the roller.
- Rolls 1–2 (safe): seven → **+70**; else **+sum** (doubles add faces).
- Rolls 3+: seven → **bust** pot=0 exit; doubles → **double pot** (no add faces); else **+sum**.
- **Bank** is the only exit action (current roller only). Zero pot may Bank (keep protected).
- First turn of a seat: countdown 5s → unlock Roll. Same player continuing after a non-bust roll unlocks Roll immediately. Idle 10s → auto Bank.
- Atomic Roll vs Bank.
- Synchronized SVG dice; tumble then snap to authoritative faces (no post-settle flip). Dramatic settle punch + SFX/haptics. No mute toggle on dice UI.
- Reduced-motion fallback. Full-phone mint perimeter glow when you are up.

### Worked path (tests)

Protected **95**. Pot path: `105 → 175` (safe seven) → `187` (safe 6+6) → `374` (dangerous doubles).  
Banking that pot yields **95 + 374 = 469** total beans — **469 is the banked total, not the next dice pot**.

## Party Mode

- Off by default; host may change between topics.
- Winner may give one optional sip (ties share one prompt).
- Bust → one-sip to that player only.
- Done/Pass; **no score effect**.

## Superseded (do not implement)

Bets on roster winning, individual-pick side bets, quarter-step multipliers, 4× cap, shared pots/busts, round-robin one-roll-then-pass BANK (replaced by personal continuous turn until Bank/bust), waiting-player early Bank, topic vote countdown, PREP countdown phase, dice mute toggle.

## Architecture notes

- Authoritative durable room state in PartyKit storage.
- Server timers via PartyKit `storage.setAlarm`.
- Idempotent actions + phase revisions + append-only ledger.
- Host failover ~20s when host disconnects.
- Soft bank time budget removed — round ends when everyone banks/busts.
