# Beans iPhone PWA — Performance & Quality Report

**Target:** https://beans-game.vercel.app (installed-PWA-like: mobile UA, `390×844` / `375×667`, CPU 4–6×)  
**Date:** 2026-10-10  
**Scope:** Report only — no product merges. Other agents own draft/sound/design edits.  
**Method:** Playwright Chromium + CDP CPU/network throttle; Lighthouse mobile (4× CPU); full bot game driven in-page (host + `admin_spawn_bots` ×3, `fast: true`, 1 topic round) with WS/long-task/CLS/FPS hooks; quality screenshots every phase at both viewports.

**Artifacts:** `perf/raw-metrics.json`, `perf/lighthouse.json`, `perf/screenshots/*`, and root evidence PNGs (`iphone_*`).

---

## Executive summary

Cold-load Lighthouse looks **excellent** (Performance **0.99**, LCP ≈ **2.1s**, TBT **35ms**, load CLS **0.01**). The user-reported “iPhone feels bad” problem is **not** first paint — it is **in-game**: layout shift (**CLS ≈ 2.5–2.9** over a short bot match), **short-viewport clipping**, **reconnect stall**, **Dice WS flood**, and **ResizeObserver thrash**.

| Signal | Load (Lighthouse mobile) | In-game (390×844, 6× CPU, 1 round) |
|---|---|---|
| LCP / FCP | 2117 / 1067 ms | — |
| CLS | 0.01 | **2.51** |
| TBT / long tasks | 35 ms | 1 long task (56 ms) observed; jank shows up as CLS + FPS dips |
| Min FPS (raf sampler) | — | **45** (Dice), **51** (Wager) |
| WS inbound | — | **~1.1 MB / 195 msgs**; Dice alone **~528 KB / 76 msgs** |
| Max state message | — | **~7.6 KB** |
| JS transfer (home) | ~147 KB scripts in nav resources; LH total weight ~273 KB | Room bundles already loaded |
| Fonts | 2× woff2 ≈ **63.5 KB** transfer | Nunito 4 weights + Sora 3 weights |
| CSS | `globals` chunk ≈ **95 KB** raw / **~20 KB** transfer | Single large stylesheet (~98 KB source) |

Phases covered (both viewports): LOBBY → TOPIC → DRAFT → VOTE → SCORE → WAGER → DICE → ROUND_RESULTS → GAME_RESULTS. REVIEW skipped server-side (0s skim). React DevTools commit counts were **unavailable** in the production build (hook inject never fired); re-render pressure inferred from CLS, `FitName` ResizeObserver errors, `DraftBannerClock` 250ms ticks, and full-state WS rates.

---

## Top 10 issues (by user impact)

### 1. Short iPhone viewports clip primary actions and draft UI

**Impact:** Players on SE-class / zoomed / compact PWA heights cannot reliably Start or Lock in without discovering scroll.

**Evidence:**
- `iphone_375_lobby_start_clipped.png` / `perf/screenshots/375x667_LOBBY.png` — **Start game** only a sliver at the bottom edge.
- `perf/screenshots/375x667_DRAFT.png`, `375x667_DRAFT_after_reconnect.png` — stash / Lock-in crushed or cut; empty mid-grid dominates.
- `iphone_375_topic_clipped.png` — last topic option sheared.
- `iphone_375_score_clipped.png` — score cards + “You” chip clipped.

**Proposed fix:** Sticky bottom CTA bar for Lobby Start / Draft Lock-in / Ready actions inside `.room-phase-scroll`; reduce Lobby card padding; ensure draft input docks above `safe-area-inset-bottom`. Add a scroll fade hint on PlayerRail and topic lists.

**Risk:** Low–medium. Touches shell layout shared by all phases; needs careful testing with iOS keyboard (`interactiveWidget: overlays-content` already set).

---

### 2. Catastrophic in-game layout shift (CLS ≈ 2.5) despite clean load CLS

**Impact:** The session *feels* janky on iPhone even when FPS averages ~60 — content jumps on phase changes, rail updates, and reveals.

**Evidence:**
- Playwright PerformanceObserver: **CLS 2.51** (390×844 @ 6×), **2.89** (375×667 @ 4×) over one bot round.
- Lighthouse load CLS only **0.01** — problem is post-load.
- Sources in code/CSS: phase remount via `RoomClient` `useMemo` switch; `.animate-rise` / `phase-enter` translateY; `results-reveal-row-off` uses **`opacity` + `translateY`** while Rematch chrome is already live; `PlayerRail` `scrollIntoView({ behavior: "smooth" })` on turn changes; `FitName` ResizeObserver loops (issue #7).

**Proposed fix:** Reserve stable min-heights for phase chrome + PlayerRail; prefer opacity-only enters after first paint; don’t mount endgame CTAs until reveal completes (or reserve winner rows visible with skeleton); replace smooth `scrollIntoView` with instant scroll or CSS `scroll-margin`; batch FitName (issue #7).

**Risk:** Medium. Motion/settle work is actively owned by other agents — coordinate to avoid fighting `MotionSettle` iOS crispness rules.

---

### 3. Hard socket drop leaves draft interactive under a stuck “Reconnecting…” state

**Impact:** After a flap (background kill, tunnel blip), the player can still see Lock-in / board while actions no-op; turn timers keep ticking.

**Evidence:**
- Forced close of all page WebSockets during DRAFT.
- After **15s**: `openSockets: 0`, `reconnected: false`.
- `iphone_390_draft_reconnecting.png` — pink **Reconnecting…** pill over a fully painted, interactive-looking draft (timer **33s**, Lock-in visible).
- Console: repeated `ResizeObserver loop completed with undelivered notifications.`
- Game eventually advanced (bots); human recovery lagged past the probe window.

**Proposed fix:** On `readyState !== OPEN`, disable Lock-in / votes and show a blocking reconnect sheet (not a top pill over live controls). Call `socket.reconnect()` from the same path as `visibilitychange` when `onClose` fires. Cap soft-disconnect UX copy so “Reconnecting” never coexists with enabled primary actions.

**Risk:** Medium. Reconnect / seat-lock / grace timers are delicate; regression-test multi-tab seat contention.

---

### 4. Dice phase broadcast storm (~7 KB × many) + mid-turn FPS dips

**Impact:** Every phone in the room re-parses near-full public state for each dice tick; weakest device pays paint + React reconcile cost during the most animated phase.

**Evidence (390×844 @ 6×):**
- Dice: **76** inbound msgs, **~528 KB** total, peaks **~6.9–7.6 KB**/msg.
- Full match: **195** msgs / **~1.11 MB** in.
- FPS min **45** entering Dice; Wager min **51**.
- `iphone_390_dice_phase.png` — rail already clipping 4th chip while tray animates.

**Proposed fix:** Send dice-delta messages (`dice` / `pot` / `turn` patches) instead of full `projectPublicState` on every anim tick; throttle non-critical broadcasts; keep faces/scramble client-predicted from `animSeed` (already partly designed). Consider `requestAnimationFrame` coalescing of state applies on the client.

**Risk:** Medium–high. Protocol change must stay backward compatible with in-flight clients; high test value (`verify-dice-settle`, smoke-bots).

---

### 5. Player rail horizontal overflow / clipping with no affordance

**Impact:** Active seat or “You” chip is routinely half-cut; players misread whose turn / scores.

**Evidence:**
- Dice/Results/Score screenshots: 4th chip clipped (`Bot Kai` / `Bot S…`); 375 Score **“You”** chip left-sliced and visually broken (`iphone_375_score_clipped.png`).
- `PlayerRail` uses `scrollIntoView` but no fade, dots, or peek hint; `fit` mode still overflows under pot-split labels (`UP`/`NEXT`/`IN`).

**Proposed fix:** Always allow overflow-x scroll with edge fades; shrink pot-split labels; keep “You” chip fully in view via `scroll-padding-inline`; add `aria` live turn text independent of chip visibility.

**Risk:** Low. Localized to `PlayerRail` + CSS.

---

### 6. Results reveal hides winners while Rematch / Ready is already active

**Impact:** Final/round standings look broken (only ranks 3–4), with large empty bands; players tap Rematch before seeing who won.

**Evidence:**
- `iphone_390_final_standings_partial.png` — **Final standings** shows only **3 / 4**, Rematch + **3/4 ready** already shown, ~40% empty cream.
- CSS: `.results-reveal-row-off { opacity: 0; transform: translateY(6px); }` — unrevealed winners still in DOM but invisible; CTAs in `ResultsPanel` are not gated on reveal completion.

**Proposed fix:** Gate Rematch / Next / End on `hasRevealCompleted` (or auto-skip after budget); keep off-rows out of layout (`visibility` + zero height, or don’t render) **or** show all rows immediately on `GAME_RESULTS` and only animate count-up; reduce endgame top/bottom whitespace.

**Risk:** Low–medium. Touches reveal timing tests in `results-reveal`.

---

### 7. `FitName` ResizeObserver loop thrash (console + layout)

**Impact:** iOS WebKit is sensitive to RO feedback loops; we observed **dozens** of `ResizeObserver loop completed with undelivered notifications` during a single draft — correlates with rail/chip jank and CLS.

**Evidence:**
- Console errors captured in-page during 390 game (18+ identical RO messages).
- `FitName` sets `fontSize` / `letterSpacing` inside RO callback measuring `scrollWidth` vs `clientWidth` on every chip.

**Proposed fix:** Measure once per `(text, widthBin)` with `requestAnimationFrame` debounce; stop observing after stable fit; prefer CSS `clamp` / container query font sizes for rail chips; never write styles that change observed box width.

**Risk:** Low. May slightly change nickname truncation aesthetics.

---

### 8. Draft timer re-renders the room chrome every 250ms

**Impact:** Unnecessary React work on every client during the longest phase; compounds with full-state WS updates on each pick.

**Evidence:**
- `DraftBannerClock` in `RoomClient.tsx` — `setInterval(..., 250)` → `setLeft`.
- Draft phase WS: **48** msgs / **~211 KB** in one round (4 players).
- Production React profiler unavailable; interval is a clear fixed cost on the hot path.

**Proposed fix:** Drive the timer with CSS animations or a single `requestAnimationFrame` outside React, or update via ref/DOM text node; widen interval to 1000ms; memoize panels so chrome clock cannot reconcile DraftBoard.

**Risk:** Low. Easy win if DraftPanel memo boundaries are clean.

---

### 9. CSS + font weight cost on mid-tier iPhone CPU

**Impact:** Not the main jank source (LH still 0.99), but adds parse/style cost before first interaction and competes with PartySocket bring-up on cellular.

**Evidence:**
- Lighthouse: total byte weight **~273 KB**; unused JS savings estimate **~54 KB** on two large chunks (`114vjgg…`, `33swp7…`).
- Fonts: **~63.5 KB** transfer (Nunito 400/600/700/800 + Sora 600/700/800).
- CSS chunk **~95 KB** uncompressed; `src/app/globals.css` ≈ **98 KB** source with many phase-specific rules always shipped.

**Proposed fix:** Drop unused Nunito/Sora weights; split dice/endgame CSS; route-level or phase-level CSS import; trim unused JS via tighter client boundaries (admin/diag/dice-lab).

**Risk:** Low for font subsetting; medium for CSS splits (regression in phase styling).

---

### 10. Identity / chrome polish bugs that read as “glitchy” on PWA

**Impact:** Trust and clarity — feels unfinished even when rules engine is fine.

**Evidence:**
- Rail label **“You”** vs draft column **“Profiler”** on the same screen (`iphone_390_draft_reconnecting.png`).
- Topic/Draft **“Rounds locked”** and reconnect pill collide with status-bar / notch zone (safe-area).
- Host-only strings leak into hierarchy (`AI judge on · gemini-…`, admin notices) — fine for host debug, noisy if ever shown more widely.
- Low-contrast meta (`SAFE`/`RISKING`, `Rolling…`) — a11y score **0.89**.
- Active draft cell is a tiny **“…”** — reads as failed render.

**Proposed fix:** One display rule: board headers use the same `railYouLabel` as chips; move host AI line into Settings; strengthen safe-top for notices; replace `…` with a clear “Your pick” placeholder; bump meta contrast.

**Risk:** Low. Mostly copy/CSS; coordinate with design agents on draft cell treatment.

---

## Phase jank cheat-sheet (390×844, 6× CPU)

| Phase | WS in (count / KB) | Notes |
|---|---|---|
| LOBBY | 6 / 12 | Start CTA clip on 375 |
| TOPIC_SELECTION | 15 / 41 | Option clip on 375; OK FPS |
| DRAFT | 48 / 211 | Reconnect failure UX; RO errors; clock ticks |
| VOTING_AND_JUDGING | 18 / 99 | Bottom roster clip; “Waiting on you” vs “AI calculating” |
| SCORE_REVEAL | 12 / 79 | Cards clipped; “You” chip glitch on 375 |
| WAGER_SELECTION | 12 / 80 | FPS dip to 51; left chip fragment |
| DICE | **76 / 528** | Largest cost; FPS 45; rail clip |
| ROUND_RESULTS | 3 / 14 | Reveal hides leaders |
| GAME_RESULTS | 4 / 20 | Same reveal + empty endgame |

Memory (CDP `JSHeapUsedSize`): roughly **4.7–6.6 MB** across phases — no runaway leak in a 1-round bot game; not the top issue.

---

## What is *not* the problem

- **Cold load / LCP** on production is already strong under mobile LH throttling.
- **No three.js** on the live dice path (flat SVG pip dice) — good; don’t reintroduce WebGL for iPhone.
- **Bundle size** is moderate; chase in-game state/layout before another micro-optimization pass on home JS.

---

## Suggested fix order (for follow-up agents)

1. Sticky CTAs + short-viewport draft dock (#1)  
2. Disable controls while reconnecting + force reconnect on close (#3)  
3. Rail overflow affordance + FitName RO fix (#5, #7)  
4. Stabilize phase heights / gate results CTAs (#2, #6)  
5. Dice delta broadcasts (#4)  
6. Draft clock + font/CSS trim (#8, #9)  
7. You/label polish (#10)

---

## Repro

```bash
# Metrics harness used for this report (not committed):
node /tmp/beans-perf/audit.mjs
# Outputs: /opt/cursor/artifacts/perf/{raw-metrics,lighthouse,screenshots}

# Server-side bot smoke (complementary):
npm run smoke:bots
```
