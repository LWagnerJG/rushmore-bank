/**
 * Beans — authoritative PartyKit room server.
 * Durable state + storage alarms for deadlines (survive host tab sleep).
 */
import type * as Party from "partykit/server";
import {
  emptyRoomState,
  normalizePick,
  type ClientMessage,
  type HostSettings,
  type LedgerEntry,
  type Player,
  type PublicRoomState,
  type RoomState,
  type ServerMessage,
  type TopicOption,
} from "../src/shared/types";
import {
  RULES,
  topicRoundsForPlayerCount,
  topicShortlistCount,
} from "../src/shared/rules";
import {
  pickRandomTopics,
  type TopicScope,
} from "../src/shared/topics";
import {
  animSeedFrom,
  applyDiceRoll,
  applyVoteCounts,
  applyWager,
  maxWager,
  bankPotIntoProtected,
  buildAnonymousRosters,
  classifyPullOut,
  diceAnimWindow,
  judgeRequestPayload,
  neutralJudgments,
  newRollId,
  projectPublicState,
  roll2d6,
  snakeDraftOrder,
  validateAndMapJudgments,
} from "../src/shared/engine";

import { cleanDraftOptions, starterDraftOptions } from "../src/shared/draft-options";

function roomEnv(room: Party.Room): Record<string, string | undefined> {
  return (
    (room as unknown as { env?: Record<string, string | undefined> }).env ?? {}
  );
}

/** Normalize persisted state after schema additions. */
function migrateState(raw: RoomState): RoomState {
  const base = emptyRoomState(raw.code || "ROOM");
  return {
    ...base,
    ...raw,
    configuredTopicRounds:
      raw.configuredTopicRounds ?? base.configuredTopicRounds,
    judgeStatus: raw.judgeStatus ?? "idle",
    judgeJobId: raw.judgeJobId ?? null,
    judgeNotice: raw.judgeNotice ?? null,
    topicVotes: raw.topicVotes ?? {},
    humanVotes: raw.humanVotes ?? {},
    processedActionIds: raw.processedActionIds ?? [],
  };
}

type AlarmKind =
  | "phase"
  | "pick"
  | "wager"
  | "dice_decision"
  | "dice_idle"
  | "dice_anim"
  | "host_check";

interface AlarmPayload {
  kind: AlarmKind;
  revision: number;
  meta?: string;
}

function seatedPlayers(state: RoomState): Player[] {
  return state.players
    .filter((p) => p.role === "player" && p.seat !== null)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
}

function connectedPlayers(state: RoomState): Player[] {
  return seatedPlayers(state).filter((p) => p.connected);
}

function bump(state: RoomState) {
  state.phaseRevision += 1;
}

function ledgerPush(
  state: RoomState,
  entry: Omit<LedgerEntry, "id" | "at">,
) {
  state.ledger.push({
    ...entry,
    id: `L${state.ledger.length + 1}-${Date.now()}`,
    at: Date.now(),
  });
  // Cap ledger growth
  if (state.ledger.length > 400) {
    state.ledger = state.ledger.slice(-300);
  }
}

export default class QuarryServer implements Party.Server {
  state: RoomState;
  private alarmPayload: AlarmPayload | null = null;

  constructor(readonly room: Party.Room) {
    this.state = emptyRoomState(room.id.toUpperCase());
  }

  onRequest() {
    return Response.json({ game: "Beans", release: "beans-roundrobin-v1", minPlayers: RULES.minPlayers, maxPlayers: RULES.maxPlayers });
  }

  async onStart() {
    const saved = await this.room.storage.get<RoomState>("state");
    const alarm = await this.room.storage.get<AlarmPayload>("alarm");
    if (saved) {
      this.state = migrateState(saved);
      this.state.players = this.state.players.map((p) =>
        p.role === "spectator" ? p : { ...p, connected: false },
      );
    }
    if (alarm) this.alarmPayload = alarm;
  }

  async persist() {
    await this.room.storage.put("state", this.state);
    if (this.alarmPayload) {
      await this.room.storage.put("alarm", this.alarmPayload);
    }
  }

  async setAlarmAt(when: number, payload: AlarmPayload) {
    this.alarmPayload = payload;
    await this.room.storage.put("alarm", payload);
    await this.room.storage.setAlarm(when);
  }

  async clearAlarm() {
    this.alarmPayload = null;
    await this.room.storage.delete("alarm");
    try {
      await this.room.storage.deleteAlarm();
    } catch {
      /* ignore */
    }
  }

  send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  publicStateFor(recipientId: string): PublicRoomState {
    return projectPublicState(this.state, recipientId);
  }

  broadcastState() {
    for (const conn of this.room.getConnections()) {
      this.send(conn, {
        type: "state",
        state: this.publicStateFor(conn.id),
        youId: conn.id,
      });
    }
  }

  ensureHost() {
    const humans = this.state.players.filter(
      (p) => p.role === "player" && p.connected,
    );
    if (humans.length === 0) return;
    if (
      !this.state.players.some(
        (p) => p.isHost && p.connected && p.role === "player",
      )
    ) {
      const next = humans[0]!;
      this.state.players = this.state.players.map((p) => ({
        ...p,
        isHost: p.id === next.id,
      }));
      this.state.hostLastSeenAt = Date.now();
      this.state.notice = `${next.name} is now host`;
    }
  }

  requireHost(playerId: string): boolean {
    const p = this.state.players.find((x) => x.id === playerId);
    return !!p?.isHost;
  }

  requirePlayer(playerId: string): Player | null {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.role !== "player") return null;
    return p;
  }

  seenAction(actionId?: string): boolean {
    if (!actionId) return false;
    if (this.state.processedActionIds.includes(actionId)) return true;
    this.state.processedActionIds.push(actionId);
    if (this.state.processedActionIds.length > 200) {
      this.state.processedActionIds = this.state.processedActionIds.slice(-100);
    }
    return false;
  }

  onConnect(conn: Party.Connection) {
    const playerId = conn.id;
    const existing = this.state.players.find((p) => p.id === playerId);
    if (existing) {
      existing.connected = true;
      this.ensureHost();
      void this.persist().then(() => this.broadcastState());
    } else {
      this.send(conn, {
        type: "state",
        state: this.publicStateFor(conn.id),
        youId: conn.id,
      });
    }
  }

  onClose(conn: Party.Connection) {
    const p = this.state.players.find((x) => x.id === conn.id);
    if (p) {
      p.connected = false;
      this.ensureHost();
      void this.persist().then(() => this.broadcastState());
    }
  }

  async onAlarm() {
    const payload = this.alarmPayload;
    this.alarmPayload = null;
    if (!payload) return;
    if (payload.revision !== this.state.phaseRevision) return;

    switch (payload.kind) {
      case "phase":
        await this.onPhaseTimeout();
        break;
      case "pick":
        await this.onPickTimeout();
        break;
      case "wager":
        await this.finalizeWagers();
        break;
      case "dice_decision":
        await this.unlockRoll();
        break;
      case "dice_idle":
        await this.autoBankCurrent();
        break;
      case "dice_anim":
        await this.afterDiceAnim();
        break;
      case "host_check":
        await this.checkHostFailover();
        break;
    }
    await this.persist();
    this.broadcastState();
  }

  async onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      this.send(sender, { type: "error", message: "Bad message" });
      return;
    }

    try {
      if (this.seenAction(msg.actionId)) {
        this.broadcastState();
        return;
      }
      await this.handle(msg, sender);
      await this.persist();
      this.broadcastState();
    } catch (e) {
      const text = e instanceof Error ? e.message : "Server error";
      this.send(sender, { type: "error", message: text });
    }
  }

  async handle(msg: ClientMessage, sender: Party.Connection) {
    const id = sender.id;

    switch (msg.type) {
      case "join":
        this.handleJoin(id, msg.name, msg.role ?? "player");
        this.send(sender, {
          type: "joined",
          youId: id,
          state: this.publicStateFor(id),
        });
        return;
      case "host_heartbeat": {
        const p = this.state.players.find((x) => x.id === id);
        if (p?.isHost) this.state.hostLastSeenAt = Date.now();
        return;
      }
      case "update_settings":
        this.handleSettings(id, msg.settings);
        return;
      case "start":
        await this.handleStart(id);
        return;
      case "spin_topics":
      case "majority_reroll":
        await this.handleSpinTopics(id, msg.type === "majority_reroll");
        return;
      case "vote_topic":
        await this.handleVoteTopic(id, msg.topicId);
        return;
      case "custom_topic":
        await this.handleCustomTopic(id, msg.text, msg.scope, msg.scopeBoundary);
        return;
      case "lock_in":
        await this.handleLockIn(id, msg.text);
        return;
      case "host_pause":
        this.handlePause(id);
        return;
      case "host_resume":
        await this.handleResume(id);
        return;
      case "host_extend":
        await this.handleExtend(id);
        return;
      case "host_correct":
        await this.handleCorrect(id, msg.turnIndex, msg.reason);
        return;
      case "submit_vote":
        await this.handleVote(id, msg.targetPlayerId);
        return;
      case "submit_ai_judgments":
        // Reject client-authored AI scores — judging is server-authoritative.
        throw new Error("AI judging is server-side only");
      case "submit_wager":
        await this.handleWager(id, msg.amount);
        return;
      case "roll":
        await this.handleRoll(id);
        return;
      case "pull_out":
        await this.handlePullOut(id);
        return;
      case "party_resolve":
        this.handlePartyResolve(id, msg.choice);
        return;
      case "skip_review":
        await this.handleSkipReview(id);
        return;
      case "next_topic":
        await this.handleNextTopic(id);
        return;
      case "end_game":
        this.handleEndGame(id);
        return;
      case "play_again":
        await this.handlePlayAgain(id);
        return;
      case "void_topic":
        this.handleVoidTopic(id);
        return;
      case "advance":
        await this.handleAdvance(id);
        return;
      case "dice_ready_ack":
        return;
      default:
        throw new Error("Unknown action");
    }
  }

  handleJoin(id: string, name: string, role: "player" | "spectator") {
    const clean = name.trim().slice(0, 18);
    if (!clean) throw new Error("Enter a nickname");

    const existing = this.state.players.find((p) => p.id === id);
    if (existing) {
      existing.name = clean;
      existing.connected = true;
      this.ensureHost();
      return;
    }

    if (role === "player" && this.state.rosterLocked) {
      // Late join → spectator until next game
      role = "spectator";
      this.state.notice = `${clean} joined as spectator (roster locked)`;
    }

    const playerCount = this.state.players.filter((p) => p.role === "player")
      .length;
    if (role === "player" && playerCount >= RULES.maxPlayers) {
      role = "spectator";
      this.state.notice = "Room full — joined as spectator";
    }

    const isFirst =
      this.state.players.filter((p) => p.role === "player").length === 0 &&
      role === "player";

    const player: Player = {
      id,
      name: clean,
      stones: RULES.startBalance,
      connected: true,
      isHost: isFirst,
      role,
      seat: null,
      joinedAt: Date.now(),
    };
    this.state.players.push(player);
    if (isFirst) this.state.hostLastSeenAt = Date.now();
  }

  handleSettings(id: string, partial: Partial<HostSettings>) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (this.state.phase !== "LOBBY") {
      // Party mode may change between topics
      if (
        this.state.phase === "ROUND_RESULTS" ||
        this.state.phase === "SCORE_REVEAL"
      ) {
        if (typeof partial.partyMode === "boolean") {
          this.state.settings.partyMode = partial.partyMode;
        }
        return;
      }
      throw new Error("Settings locked during play");
    }
    this.state.settings = { ...this.state.settings, ...partial };
  }

  async handleStart(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (this.state.phase !== "LOBBY") throw new Error("Already started");
    const hopeful = this.state.players.filter((p) => p.role === "player");
    if (hopeful.length < RULES.minPlayers) {
      throw new Error(`Need ${RULES.minPlayers}–${RULES.maxPlayers} players`);
    }
    if (hopeful.length > RULES.maxPlayers) {
      throw new Error("Too many players");
    }

    // Lock roster + assign seats (shuffle)
    const shuffled = [...hopeful].sort(() => Math.random() - 0.5);
    this.state.players = this.state.players.map((p) => {
      if (p.role !== "player") return { ...p, seat: null };
      const idx = shuffled.findIndex((s) => s.id === p.id);
      return { ...p, seat: idx };
    });
    this.state.seatOrder = shuffled.map((p) => p.id);
    this.state.rosterLocked = true;
    this.state.starterOffset = 0;
    this.state.topicRound = 0;
    this.state.configuredTopicRounds = topicRoundsForPlayerCount(shuffled.length);
    this.state.usedTopicIds = [];
    this.state.checkpoint = {
      stones: Object.fromEntries(
        seatedPlayers(this.state).map((p) => [p.id, p.stones]),
      ),
      topicRound: 0,
    };
    bump(this.state);
    await this.beginTopicSelection();
  }

  async beginTopicSelection() {
    this.state.phase = "TOPIC_SELECTION";
    this.state.topicVotes = {};
    this.state.selectedTopic = null;
    this.state.draftOptions = [];
    this.state.draftOptionsStatus = "idle";
    this.state.draftOptionsJobId = null;
    this.state.topicRerollsUsed = 0;
    this.state.scores = [];
    this.state.scoresLocked = false;
    this.state.judgeStatus = "idle";
    this.state.judgeJobId = null;
    this.state.judgeNotice = null;
    this.state.earnedThisRound = {};
    this.state.wagers = {};
    this.state.wagerDeadlineAt = null;
    this.state.diceActiveIds = [];
    this.state.personalRollCounts = {};
    this.state.pots = {};
    this.state.protectedStones = {};
    this.state.lastDice = null;
    this.state.diceSubphase = "WAITING";
    this.state.diceDecisionDeadlineAt = null;
    this.state.diceIdleDeadlineAt = null;
    this.state.diceRoundStartedAt = null;
    this.state.diceLapsCompleted = 0;
    this.state.partyPrompt = null;
    this.state.humanVotes = {};
    this.state.picks = [];
    this.state.takenNormalized = [];
    this.state.draftCursor = 0;
    this.state.notice = null;
    bump(this.state);
    this.spinShortlist();
    this.state.phaseDeadlineAt =
      Date.now() + RULES.topicVoteSeconds * 1000;
    await this.setAlarmAt(this.state.phaseDeadlineAt, {
      kind: "phase",
      revision: this.state.phaseRevision,
    });
  }

  spinShortlist() {
    const n = seatedPlayers(this.state).length;
    const count =
      this.state.settings.topicCountOverride ?? topicShortlistCount(n);
    let pool = pickRandomTopics(count * 3, this.state.usedTopicIds);
    const mix = this.state.settings.scopeMix.filter((s) => s !== "custom");
    if (mix.length > 0) {
      const filtered = pool.filter((t) => mix.includes(t.scope));
      if (filtered.length >= count) pool = filtered;
    }
    const picked = pool.slice(0, count);
    this.state.topicOptions = picked.map((t) => ({
      id: t.id,
      text: t.text,
      scope: t.scope,
      scopeBoundary: t.scopeBoundary,
    }));
    this.state.topicVotes = {};
  }

  async handleSpinTopics(id: string, isReroll: boolean) {
    if (!this.requireHost(id) && !isReroll) throw new Error("Host only");
    if (this.state.phase !== "TOPIC_SELECTION") throw new Error("Wrong phase");
    if (isReroll) {
      if (this.state.topicRerollsUsed >= RULES.majorityRerollsPerSelection) {
        throw new Error("Reroll already used");
      }
      // Majority of connected players must have voted for __reroll__ via vote? 
      // Spec: 1 majority reroll/topic selection — host can trigger after majority agrees.
      // Simplify: host triggers reroll once, or if ≥ half voted the special id.
      this.state.topicRerollsUsed += 1;
    }
    this.spinShortlist();
    bump(this.state);
    this.state.phaseDeadlineAt =
      Date.now() + RULES.topicVoteSeconds * 1000;
    await this.setAlarmAt(this.state.phaseDeadlineAt, {
      kind: "phase",
      revision: this.state.phaseRevision,
    });
  }

  async handleCustomTopic(
    id: string,
    text: string,
    scope: TopicScope,
    scopeBoundary: string,
  ) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (this.state.phase !== "TOPIC_SELECTION") throw new Error("Wrong phase");
    const clean = text.trim().slice(0, 80);
    if (clean.length < 3) throw new Error("Topic too short");
    const option: TopicOption = {
      id: `custom-${Date.now()}`,
      text: clean,
      scope: scope === "custom" ? "everyday" : scope,
      scopeBoundary: (scopeBoundary || "Host custom topic.").slice(0, 160),
      isCustom: true,
    };
    this.state.topicOptions = [option];
    this.state.selectedTopic = option;
    await this.lockTopic(option);
  }

  async handleVoteTopic(id: string, topicId: string) {
    if (!this.requirePlayer(id)) throw new Error("Players only");
    if (this.state.phase !== "TOPIC_SELECTION") throw new Error("Wrong phase");
    if (!this.state.topicOptions.some((t) => t.id === topicId)) {
      throw new Error("Invalid topic");
    }
    this.state.topicVotes[id] = topicId;
    const needed = connectedPlayers(this.state).length;
    const votes = Object.keys(this.state.topicVotes).length;
    if (votes >= needed && needed > 0) {
      await this.tallyTopicVotes();
    }
  }

  async tallyTopicVotes() {
    const counts = new Map<string, number>();
    for (const tid of Object.values(this.state.topicVotes)) {
      counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
    let best = 0;
    for (const c of counts.values()) best = Math.max(best, c);
    const tied = [...counts.entries()]
      .filter(([, c]) => c === best)
      .map(([id]) => id);
    const winnerId =
      tied[Math.floor(Math.random() * tied.length)] ??
      this.state.topicOptions[0]?.id;
    const option =
      this.state.topicOptions.find((t) => t.id === winnerId) ??
      this.state.topicOptions[0];
    if (!option) throw new Error("No topics");
    await this.lockTopic(option);
  }

  async lockTopic(option: TopicOption) {
    this.state.selectedTopic = option;
    if (!option.isCustom) {
      this.state.usedTopicIds.push(option.id);
    }
    this.state.checkpoint = {
      stones: Object.fromEntries(
        seatedPlayers(this.state).map((p) => [p.id, p.stones]),
      ),
      topicRound: this.state.topicRound,
    };
    bump(this.state);
    this.state.draftOptions = starterDraftOptions(option.id, option.text);
    this.state.draftOptionsStatus = this.state.draftOptions.length ? "ready" : "pending";
    await this.beginPrep();
    if (!this.state.draftOptions.length) {
      const jobId = crypto.randomUUID();
      this.state.draftOptionsJobId = jobId;
      void this.loadDraftOptions(option, jobId);
    }
  }

  async loadDraftOptions(topic: TopicOption, jobId: string) {
    const env = roomEnv(this.room);
    let options: string[] = [];
    try {
      if (env.JUDGE_URL && env.JUDGE_SECRET) {
        const res = await fetch(`${env.JUDGE_URL.replace(/\/$/, "")}/api/draft-options`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.JUDGE_SECRET}` },
          body: JSON.stringify({ topic: topic.text, scopeBoundary: topic.scopeBoundary }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) options = cleanDraftOptions((await res.json() as { options?: unknown }).options);
      }
    } catch { /* Manual answers always remain available. */ }
    if (this.state.draftOptionsJobId !== jobId || this.state.selectedTopic?.id !== topic.id) return;
    if (!["PREP", "DRAFT", "CORRECTION"].includes(this.state.phase)) return;
    this.state.draftOptions = options;
    this.state.draftOptionsStatus = options.length ? "ready" : "unavailable";
    this.state.draftOptionsJobId = null;
    await this.persist();
    this.broadcastState();
  }

  async beginPrep() {
    this.state.phase = "PREP";
    this.state.phaseDeadlineAt = Date.now() + RULES.prepSeconds * 1000;
    bump(this.state);
    await this.setAlarmAt(this.state.phaseDeadlineAt, {
      kind: "phase",
      revision: this.state.phaseRevision,
    });
  }

  async beginDraft() {
    const n = this.state.seatOrder.length;
    this.state.draftOrder = snakeDraftOrder(n, RULES.picksPerPlayer, this.state.starterOffset);
    this.state.draftCursor = 0;
    this.state.picks = [];
    this.state.takenNormalized = [];
    this.state.phase = "DRAFT";
    this.state.correctionResume = null;
    this.state.correctionReason = null;
    this.state.correctionTargetPickId = null;
    this.state.pickPaused = false;
    bump(this.state);
    await this.startPickClock();
  }

  currentDraftPlayerId(): string | null {
    const seatIdx = this.state.draftOrder[this.state.draftCursor];
    if (seatIdx === undefined) return null;
    return this.state.seatOrder[seatIdx] ?? null;
  }

  async startPickClock() {
    this.state.pickDeadlineAt =
      Date.now() + (RULES.pickClockSeconds + RULES.pickGraceSeconds) * 1000;
    await this.setAlarmAt(this.state.pickDeadlineAt, {
      kind: "pick",
      revision: this.state.phaseRevision,
    });
  }

  async handleLockIn(id: string, text: string) {
    if (
      this.state.phase !== "DRAFT" &&
      this.state.phase !== "CORRECTION"
    ) {
      throw new Error("Not drafting");
    }
    if (this.state.pickPaused) throw new Error("Clock paused");
    const expected = this.currentDraftPlayerId();
    if (expected !== id) throw new Error("Not your turn");
    const clean = text.trim().slice(0, 48);
    if (clean.length < 1) throw new Error("Enter a pick");
    const norm = normalizePick(clean);
    if (this.state.takenNormalized.includes(norm)) {
      throw new Error("Already taken");
    }

    const playerPicks = this.state.picks.filter((p) => p.playerId === id);
    const pickIndex = playerPicks.length;
    if (pickIndex >= RULES.picksPerPlayer && this.state.phase === "DRAFT") {
      throw new Error("Roster full");
    }

    if (this.state.phase === "CORRECTION") {
      // Replace removed pick slot
      const turnIndex = this.state.draftCursor;
      this.state.picks.push({
        playerId: id,
        text: clean,
        pickIndex: this.state.correctionResume?.pickIndex ?? Math.min(pickIndex, RULES.picksPerPlayer - 1),
        turnIndex,
      });
      this.state.takenNormalized.push(norm);
      await this.finishCorrection();
      return;
    }

    this.state.picks.push({
      playerId: id,
      text: clean,
      pickIndex,
      turnIndex: this.state.draftCursor,
    });
    this.state.takenNormalized.push(norm);
    this.state.draftCursor += 1;
    bump(this.state);

    if (this.state.draftCursor >= this.state.draftOrder.length) {
      await this.beginReview();
    } else {
      await this.startPickClock();
    }
  }

  async onPickTimeout() {
    if (this.state.phase !== "DRAFT" && this.state.phase !== "CORRECTION") return;
    if (this.state.pickPaused) return;
    // Missed pick — placeholder with unique miss tag
    const pid = this.currentDraftPlayerId();
    if (!pid) return;
    const miss = `Missed pick (${this.state.draftCursor + 1})`;
    const norm = normalizePick(`${miss}-${pid}-${this.state.draftCursor}`);
    const playerPicks = this.state.picks.filter((p) => p.playerId === pid);
    this.state.picks.push({
      playerId: pid,
      text: miss,
      pickIndex: this.state.phase === "CORRECTION"
        ? (this.state.correctionResume?.pickIndex ?? playerPicks.length)
        : playerPicks.length,
      turnIndex: this.state.draftCursor,
    });
    this.state.takenNormalized.push(norm);
    this.state.notice = `Clock expired — missed pick for ${
      this.state.players.find((p) => p.id === pid)?.name ?? "player"
    }`;
    if (this.state.phase === "CORRECTION") {
      await this.finishCorrection();
      return;
    }
    this.state.draftCursor += 1;
    bump(this.state);
    if (this.state.draftCursor >= this.state.draftOrder.length) {
      await this.beginReview();
    } else {
      await this.startPickClock();
      await this.persist();
    }
  }

  handlePause(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (this.state.phase !== "DRAFT" && this.state.phase !== "CORRECTION") {
      throw new Error("Wrong phase");
    }
    if (this.state.pickPaused) return;
    this.state.pickPaused = true;
    if (this.state.pickDeadlineAt) {
      this.state.pickPauseRemainingMs = Math.max(
        0,
        this.state.pickDeadlineAt - Date.now(),
      );
    }
    void this.clearAlarm();
  }

  async handleResume(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (!this.state.pickPaused) return;
    this.state.pickPaused = false;
    const rem = this.state.pickPauseRemainingMs ?? RULES.pickClockSeconds * 1000;
    this.state.pickDeadlineAt = Date.now() + rem;
    this.state.pickPauseRemainingMs = null;
    await this.setAlarmAt(this.state.pickDeadlineAt, {
      kind: "pick",
      revision: this.state.phaseRevision,
    });
  }

  async handleExtend(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (!this.state.pickDeadlineAt) return;
    this.state.pickDeadlineAt += RULES.hostExtendSeconds * 1000;
    if (!this.state.pickPaused) {
      await this.setAlarmAt(this.state.pickDeadlineAt, {
        kind: "pick",
        revision: this.state.phaseRevision,
      });
    } else if (this.state.pickPauseRemainingMs != null) {
      this.state.pickPauseRemainingMs += RULES.hostExtendSeconds * 1000;
    }
  }

  async handleCorrect(
    id: string,
    turnIndex: number,
    reason: "duplicate" | "invalid",
  ) {
    if (!this.requireHost(id)) throw new Error("Host only");
    // Validate before touching picks; rejected corrections must be read-only.
    if (this.state.scoresLocked) throw new Error("Scores locked — discard the round to restart");
    if (!["DRAFT", "REVIEW", "VOTING_AND_JUDGING"].includes(this.state.phase)) {
      throw new Error("Finish the current action before correcting a pick");
    }
    const pick = this.state.picks.find((p) => p.turnIndex === turnIndex);
    if (!pick) throw new Error("Pick not found");
    this.state.correctionResume = {
      phase: this.state.phase === "DRAFT" ? "DRAFT" : "REVIEW",
      cursor: this.state.draftCursor,
      pickIndex: pick.pickIndex,
      remainingMs: this.state.pickPaused
        ? this.state.pickPauseRemainingMs
        : this.state.pickDeadlineAt === null ? null : Math.max(0, this.state.pickDeadlineAt - Date.now()),
      paused: this.state.pickPaused,
    };
    this.state.picks = this.state.picks.filter((p) => p.turnIndex !== turnIndex);
    this.state.takenNormalized = this.state.picks.map((p) => normalizePick(p.text));
    this.state.humanVotes = {};
    this.state.scores = [];
    this.state.judgeJobId = null; // Any in-flight response belongs to the old picks.
    this.state.judgeStatus = "idle";
    this.state.judgeNotice = null;
    this.state.phase = "CORRECTION";
    this.state.correctionReason = reason;
    this.state.correctionTargetPickId = String(turnIndex);
    this.state.draftCursor = turnIndex;
    this.state.phaseDeadlineAt = null;
    bump(this.state);
    this.state.pickPaused = false;
    await this.startPickClock();
  }

  async finishCorrection() {
    const resume = this.state.correctionResume;
    // Legacy persisted corrections have no resume record. Continue after the
    // latest completed turn, not after the replaced slot.
    const cursor = resume?.cursor ?? Math.max(0, ...this.state.picks.map((p) => p.turnIndex + 1));
    this.state.correctionResume = null;
    this.state.correctionReason = null;
    this.state.correctionTargetPickId = null;
    this.state.draftCursor = cursor;
    this.state.pickPaused = false;
    bump(this.state);
    if (resume?.phase === "REVIEW" || cursor >= this.state.draftOrder.length) {
      await this.beginReview();
      return;
    }
    this.state.phase = "DRAFT";
    const remaining = resume?.remainingMs ?? (RULES.pickClockSeconds + RULES.pickGraceSeconds) * 1000;
    this.state.pickDeadlineAt = Date.now() + remaining;
    this.state.pickPaused = resume?.paused ?? false;
    this.state.pickPauseRemainingMs = this.state.pickPaused ? remaining : null;
    if (this.state.pickPaused) await this.clearAlarm();
    else await this.setAlarmAt(this.state.pickDeadlineAt, { kind: "pick", revision: this.state.phaseRevision });
  }

  async beginReview() {
    this.state.phase = "REVIEW";
    this.state.phaseDeadlineAt = Date.now() + RULES.reviewSeconds * 1000;
    bump(this.state);
    await this.setAlarmAt(this.state.phaseDeadlineAt, {
      kind: "phase",
      revision: this.state.phaseRevision,
    });
  }

  async handleSkipReview(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (this.state.phase !== "REVIEW") return;
    await this.beginVoting();
  }

  async beginVoting() {
    this.state.phase = "VOTING_AND_JUDGING";
    this.state.humanVotes = {};
    this.state.scores = [];
    this.state.scoresLocked = false;
    this.state.judgeStatus = "pending";
    this.state.judgeNotice = null;
    this.state.judgeJobId = `judge-${this.state.topicRound}-${this.state.phaseRevision + 1}`;
    this.state.phaseDeadlineAt = Date.now() + RULES.humanVoteSeconds * 1000;
    bump(this.state);
    await this.setAlarmAt(this.state.phaseDeadlineAt, {
      kind: "phase",
      revision: this.state.phaseRevision,
    });
    // Fire-and-forget trusted judging job (does not block votes)
    void this.runJudgingJob(this.state.judgeJobId);
  }

  async runJudgingJob(jobId: string) {
    const topic = this.state.selectedTopic;
    if (!topic) {
      this.applyJudgeFallback(jobId, "No topic — neutral award.");
      return;
    }
    const picksByPlayer: Record<string, string[]> = {};
    for (const pid of this.state.seatOrder) {
      picksByPlayer[pid] = this.state.picks
        .filter((pk) => pk.playerId === pid)
        .sort((a, b) => a.pickIndex - b.pickIndex)
        .map((pk) => pk.text);
    }
    const rosters = buildAnonymousRosters(this.state.seatOrder, picksByPlayer);
    const payload = judgeRequestPayload(
      topic.text,
      topic.scopeBoundary,
      rosters,
    );

    const env = roomEnv(this.room);
    const judgeBase =
      env.JUDGE_URL?.replace(/\/$/, "") ||
      env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "https://roundacats.vercel.app";
    const secret = env.JUDGE_SECRET || env.OPENAI_API_KEY;

    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        RULES.judgeTimeoutMs,
      );
      const res = await fetch(`${judgeBase}/api/judge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.JUDGE_SECRET
            ? { Authorization: `Bearer ${env.JUDGE_SECRET}` }
            : {}),
          "X-Quarry-Judge": "partykit",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Stale job guard
      if (this.state.judgeJobId !== jobId || this.state.scoresLocked) return;
      if (this.state.phase !== "VOTING_AND_JUDGING") return;

      if (!res.ok) {
        this.applyJudgeFallback(
          jobId,
          `Judge unavailable · neutral award. (HTTP ${res.status})`,
        );
        return;
      }
      const data = (await res.json()) as {
        judgments?: Array<{
          anonId?: string;
          playerId?: string;
          topicFit: number;
          pickStrength: number;
          rosterQuality: number;
          explanation: string;
        }>;
        fallback?: boolean;
        limitation?: string;
      };

      if (this.state.judgeJobId !== jobId || this.state.scoresLocked) return;

      if (data.fallback || !data.judgments) {
        this.applyJudgeFallback(
          jobId,
          data.limitation || RULES.aiFallbackLabel,
        );
        return;
      }

      const mapped = validateAndMapJudgments(rosters, data.judgments);
      if (!mapped) {
        this.applyJudgeFallback(jobId, RULES.aiFallbackLabel);
        return;
      }

      this.state.scores = mapped;
      this.state.judgeStatus = "ready";
      this.state.judgeNotice = null;
      await this.persist();
      this.broadcastState();
      await this.maybeFinalizeAfterJudge();
    } catch {
      if (this.state.judgeJobId !== jobId || this.state.scoresLocked) return;
      this.applyJudgeFallback(
        jobId,
        secret
          ? RULES.aiFallbackLabel
          : "Judge unavailable · neutral award. (AI key / JUDGE_SECRET not configured on server)",
      );
    }
  }

  applyJudgeFallback(jobId: string, notice: string) {
    if (this.state.judgeJobId !== jobId || this.state.scoresLocked) return;
    if (this.state.phase !== "VOTING_AND_JUDGING") return;
    const picksByPlayer: Record<string, string[]> = {};
    for (const pid of this.state.seatOrder) {
      picksByPlayer[pid] = this.state.picks
        .filter((pk) => pk.playerId === pid)
        .map((pk) => pk.text);
    }
    const rosters = buildAnonymousRosters(this.state.seatOrder, picksByPlayer);
    this.state.scores = neutralJudgments(rosters);
    this.state.judgeStatus = "failed";
    this.state.judgeNotice = notice;
    void this.persist().then(() => this.broadcastState());
    void this.maybeFinalizeAfterJudge();
  }

  async maybeFinalizeAfterJudge() {
    if (this.state.scoresLocked) return;
    if (this.state.scores.length === 0) return;
    const needed = seatedPlayers(this.state).filter((p) => p.connected).length;
    const votesIn = Object.keys(this.state.humanVotes).length;
    if (
      this.state.seatOrder.length === 2 ||
      (needed > 0 && votesIn >= needed) ||
      (this.state.phaseDeadlineAt !== null &&
        Date.now() >= this.state.phaseDeadlineAt)
    ) {
      await this.finalizeScores();
      await this.persist();
      this.broadcastState();
    }
  }

  async handleVote(id: string, targetPlayerId: string) {
    if (!this.requirePlayer(id)) throw new Error("Players only");
    if (this.state.phase !== "VOTING_AND_JUDGING") throw new Error("Wrong phase");
    if (this.state.seatOrder.length === 2) throw new Error("Two-player games use the AI judge");
    if (id === targetPlayerId) throw new Error("No self-vote");
    if (!this.state.seatOrder.includes(targetPlayerId)) {
      throw new Error("Invalid target");
    }
    // One effective ballot per eligible player (overwrite allowed = last write wins)
    this.state.humanVotes[id] = targetPlayerId;
    const needed = seatedPlayers(this.state).filter((p) => p.connected).length;
    if (
      Object.keys(this.state.humanVotes).length >= needed &&
      needed > 0 &&
      this.state.scores.length > 0
    ) {
      await this.finalizeScores();
    }
  }

  async finalizeScores() {
    if (this.state.scoresLocked) return;

    if (this.state.scores.length === 0) {
      const picksByPlayer: Record<string, string[]> = {};
      for (const pid of this.state.seatOrder) {
        picksByPlayer[pid] = this.state.picks
          .filter((pk) => pk.playerId === pid)
          .map((pk) => pk.text);
      }
      this.state.scores = neutralJudgments(
        buildAnonymousRosters(this.state.seatOrder, picksByPlayer),
      );
      this.state.judgeStatus = "failed";
      this.state.judgeNotice = RULES.aiFallbackLabel;
    }

    this.state.scores = applyVoteCounts(
      this.state.scores,
      this.state.seatOrder.length === 2 ? {} : this.state.humanVotes,
    );
    this.state.earnedThisRound = Object.fromEntries(
      this.state.scores.map((s) => [s.playerId, s.earned]),
    );
    this.state.scoresLocked = true;
    this.state.phase = "SCORE_REVEAL";
    this.state.phaseDeadlineAt = null;
    await this.clearAlarm();
    bump(this.state);
  }

  async handleAdvance(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    switch (this.state.phase) {
      case "PREP":
        await this.beginDraft();
        return;
      case "SCORE_REVEAL":
        await this.beginWagers();
        return;
      case "ROUND_RESULTS":
        await this.handleNextTopic(id);
        return;
      case "REVIEW":
        await this.beginVoting();
        return;
      default:
        throw new Error("Nothing to advance");
    }
  }

  async beginWagers() {
    this.state.phase = "WAGER_SELECTION";
    this.state.wagers = {};
    this.state.wagerDeadlineAt = Date.now() + RULES.wagerTimeoutSeconds * 1000;
    bump(this.state);
    await this.setAlarmAt(this.state.wagerDeadlineAt, {
      kind: "wager",
      revision: this.state.phaseRevision,
    });
  }

  async handleWager(id: string, amount: number) {
    if (!this.requirePlayer(id)) throw new Error("Players only");
    if (this.state.phase !== "WAGER_SELECTION") throw new Error("Wrong phase");
    const p = this.state.players.find((x) => x.id === id)!;
    const E = this.state.earnedThisRound[id] ?? 0;
    const B = p.stones;
    const max = maxWager(E, B);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > max) {
      throw new Error(`Choose a whole number from 0 to ${max}`);
    }
    if (this.state.wagers[id] !== undefined) throw new Error("Wager already locked");
    this.state.wagers[id] = amount;

    const needed = seatedPlayers(this.state).length;
    if (Object.keys(this.state.wagers).length >= needed) {
      await this.finalizeWagers();
    }
  }

  async finalizeWagers() {
    if (this.state.phase !== "WAGER_SELECTION") return;
    for (const pid of this.state.seatOrder) {
      if (this.state.wagers[pid] === undefined) {
        this.state.wagers[pid] = 0;
      }
    }

    this.state.pots = {};
    this.state.protectedStones = {};
    this.state.personalRollCounts = {};
    this.state.diceActiveIds = [];

    for (const pid of this.state.seatOrder) {
      const p = this.state.players.find((x) => x.id === pid)!;
      const E = this.state.earnedThisRound[pid] ?? 0;
      const B = p.stones;
      const W = this.state.wagers[pid] ?? 0;
      const locked = applyWager({ banked: B, earned: E, wager: W });
      this.state.protectedStones[pid] = locked.protected;
      this.state.pots[pid] = locked.pot;
      this.state.personalRollCounts[pid] = 0;
      p.stones = locked.bankedAfter;
      this.state.diceActiveIds.push(pid);
      ledgerPush(this.state, {
        playerId: pid,
        kind: "wager_lock",
        amount: -W,
        balanceAfter: p.stones,
        note: `${W} beans in the pot`,
        topicRound: this.state.topicRound,
      });
    }

    this.state.wagerDeadlineAt = null;
    bump(this.state);
    await this.beginDice();
  }

  async beginDice() {
    this.state.phase = "DICE";
    this.state.diceRoundStartedAt = Date.now();
    this.state.diceLapsCompleted = 0;
    this.state.lastDice = null;
    // Start with first active player in seat order
    const first = this.state.seatOrder.find((id) =>
      this.state.diceActiveIds.includes(id),
    );
    this.state.diceTurnSeat = first
      ? this.state.seatOrder.indexOf(first)
      : 0;
    bump(this.state);
    await this.startDiceTurn();
  }

  currentDicePlayerId(): string | null {
    return this.state.seatOrder[this.state.diceTurnSeat] ?? null;
  }

  async startDiceTurn() {
    // Skip inactive
    let guard = 0;
    while (guard++ < 20) {
      const pid = this.currentDicePlayerId();
      if (pid && this.state.diceActiveIds.includes(pid)) break;
      this.advanceDiceSeat();
    }
    const pid = this.currentDicePlayerId();
    if (!pid || this.state.diceActiveIds.length === 0) {
      await this.beginRoundResults();
      return;
    }
    this.state.diceSubphase = "COOLDOWN";
    this.state.diceDecisionDeadlineAt =
      Date.now() + RULES.diceDecisionCountdownSeconds * 1000;
    this.state.diceIdleDeadlineAt = null;
    await this.setAlarmAt(this.state.diceDecisionDeadlineAt, {
      kind: "dice_decision",
      revision: this.state.phaseRevision,
    });
  }

  async unlockRoll() {
    if (this.state.phase !== "DICE") return;
    if (this.state.diceSubphase !== "COOLDOWN") return;
    this.state.diceSubphase = "READY";
    this.state.diceIdleDeadlineAt =
      Date.now() + RULES.diceIdleBankSeconds * 1000;
    await this.setAlarmAt(this.state.diceIdleDeadlineAt, {
      kind: "dice_idle",
      revision: this.state.phaseRevision,
    });
  }

  advanceDiceSeat() {
    const n = this.state.seatOrder.length;
    if (n === 0) return;
    const prev = this.state.diceTurnSeat;
    this.state.diceTurnSeat = (this.state.diceTurnSeat + 1) % n;
    if (this.state.diceTurnSeat <= prev) {
      this.state.diceLapsCompleted += 1;
    }
  }

  async handleRoll(id: string) {
    if (this.state.phase !== "DICE") throw new Error("Wrong phase");
    if (this.state.diceSubphase !== "READY") {
      throw new Error("Wait for countdown");
    }
    if (this.currentDicePlayerId() !== id) throw new Error("Not your roll");
    if (!this.state.diceActiveIds.includes(id)) throw new Error("Not active");

    // Atomic: mark committed — blocks late Pull Out for this roller
    this.state.diceSubphase = "COMMITTED";
    await this.clearAlarm();

    const rollNum = (this.state.personalRollCounts[id] ?? 0) + 1;
    this.state.personalRollCounts[id] = rollNum;
    const [d1, d2] = roll2d6();
    const potBefore = this.state.pots[id] ?? 0;
    const outcome = applyDiceRoll(potBefore, { d1, d2 }, rollNum);
    const window = diceAnimWindow();
    const rollId = newRollId();
    this.state.lastDice = {
      rollId,
      rollerId: id,
      d1,
      d2,
      personalRollNumber: rollNum,
      potBefore,
      potAfter: outcome.potAfter,
      busted: outcome.busted,
      note: outcome.note,
      animStartedAt: window.animStartedAt,
      animSettleAt: window.animSettleAt,
      animSeed: animSeedFrom(rollId, d1, d2),
      outcomeKind: outcome.kind,
      revealed: false,
    };
    // Outcome stays server-side until settle — do not mutate pots/active yet.

    await this.setAlarmAt(window.animSettleAt, {
      kind: "dice_anim",
      revision: this.state.phaseRevision,
    });
  }

  /** Apply committed roll outcome + mark revealed (idempotent). */
  revealCommittedDice() {
    const dice = this.state.lastDice;
    if (!dice || dice.revealed) return;
    const id = dice.rollerId;
    this.state.pots[id] = dice.potAfter;
    dice.revealed = true;

    if (dice.busted) {
      this.state.diceActiveIds = this.state.diceActiveIds.filter((x) => x !== id);
      ledgerPush(this.state, {
        playerId: id,
        kind: "bust",
        amount: -dice.potBefore,
        balanceAfter: this.state.protectedStones[id] ?? 0,
        note: "Busted",
        topicRound: this.state.topicRound,
      });
      const p = this.state.players.find((x) => x.id === id);
      if (p) p.stones = this.state.protectedStones[id] ?? 0;

      if (this.state.settings.partyMode) {
        this.state.partyPrompt = {
          kind: "bust_sip",
          targetPlayerIds: [id],
          resolved: false,
        };
      }
    } else {
      ledgerPush(this.state, {
        playerId: id,
        kind: "pot_delta",
        amount: dice.potAfter - dice.potBefore,
        balanceAfter: this.state.protectedStones[id] ?? 0,
        note: dice.note,
        topicRound: this.state.topicRound,
      });
    }
    this.state.diceSubphase = "SETTLED";
  }

  async afterDiceAnim() {
    if (this.state.phase !== "DICE") return;
    this.revealCommittedDice();

    if (this.state.diceActiveIds.length === 0) {
      await this.beginRoundResults();
      return;
    }

    this.advanceDiceSeat();
    bump(this.state);
    await this.startDiceTurn();
  }

  bankPlayer(id: string, note: string) {
    const pot = this.state.pots[id] ?? 0;
    const prot = this.state.protectedStones[id] ?? 0;
    const result = bankPotIntoProtected({ protectedStones: prot, pot });
    const p = this.state.players.find((x) => x.id === id);
    if (!p) throw new Error("Player missing");
    p.stones = result.stonesAfter;
    this.state.pots[id] = 0;
    this.state.diceActiveIds = this.state.diceActiveIds.filter((x) => x !== id);
    ledgerPush(this.state, {
      playerId: id,
      kind: "bank",
      amount: result.potBanked,
      balanceAfter: p.stones,
      note,
      topicRound: this.state.topicRound,
    });
  }

  async handlePullOut(id: string) {
    if (!this.requirePlayer(id)) throw new Error("Players only");
    const current = this.currentDicePlayerId();
    const classified = classifyPullOut({
      phase: this.state.phase,
      diceSubphase: this.state.diceSubphase,
      playerId: id,
      currentRollerId: current,
      diceActiveIds: this.state.diceActiveIds,
      pot: this.state.pots[id] ?? 0,
    });
    if (!classified.ok) throw new Error(classified.reason);

    if (classified.kind === "waiting_player") {
      // Bank without touching shared countdown, animation, or seat.
      this.bankPlayer(id, "Bank (waiting)");
      // Preserve phaseRevision: the pending cooldown/roll alarm owns it.
      // onMessage still persists and broadcasts this player's new balance.
      if (this.state.diceActiveIds.length === 0) {
        // Current roller also gone somehow — end round (no in-flight commit possible
        // for waiting-only empty set if current was still active).
        await this.clearAlarm();
        await this.beginRoundResults();
      }
      // If current roller still active (incl. mid-COMMITTED), leave alarms alone.
      return;
    }

    // Current roller banking — advance seat + restart turn for next active player.
    this.bankPlayer(id, "Bank");
    bump(this.state);
    await this.clearAlarm();

    if (this.state.diceActiveIds.length === 0) {
      await this.beginRoundResults();
    } else {
      this.advanceDiceSeat();
      await this.startDiceTurn();
    }
  }

  async autoBankCurrent() {
    const pid = this.currentDicePlayerId();
    if (!pid) return;
    if (this.state.diceSubphase !== "READY") return;
    try {
      await this.handlePullOut(pid);
    } catch {
      /* ignore */
    }
  }

  async beginRoundResults() {
    // Reveal any in-flight dice before leaving the phase
    if (this.state.lastDice && !this.state.lastDice.revealed) {
      this.revealCommittedDice();
    }
    this.state.phase = "ROUND_RESULTS";
    this.state.diceSubphase = "SETTLED";
    this.state.topicRound += 1;
    // Rotate starter for next topic
    this.state.starterOffset =
      (this.state.starterOffset + 1) % Math.max(1, this.state.seatOrder.length);

    if (this.state.settings.partyMode) {
      const ranked = [...seatedPlayers(this.state)].sort(
        (a, b) => b.stones - a.stones,
      );
      const top = ranked[0]?.stones ?? 0;
      const winners = ranked.filter((p) => p.stones === top).map((p) => p.id);
      if (!this.state.partyPrompt) {
        this.state.partyPrompt = {
          kind: "winner_sip",
          targetPlayerIds: winners,
          resolved: false,
        };
      }
    }

    bump(this.state);
    await this.clearAlarm();

    // Auto final results after configured final round
    if (this.state.topicRound >= this.state.configuredTopicRounds) {
      this.state.phase = "GAME_RESULTS";
      this.state.gameOver = true;
      this.state.notice = `Final results · ${this.state.configuredTopicRounds} rounds complete`;
    }
  }

  handlePartyResolve(id: string, choice: "done" | "pass") {
    if (!this.state.partyPrompt) return;
    void choice; // Done/Pass are equivalent dismissals — no score effect
    // Any involved player or host can dismiss
    if (
      this.state.partyPrompt.targetPlayerIds.includes(id) ||
      this.requireHost(id)
    ) {
      this.state.partyPrompt = null;
    }
  }

  async handleNextTopic(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (this.state.phase === "GAME_RESULTS") {
      throw new Error("Game over — play again");
    }
    if (this.state.phase !== "ROUND_RESULTS") {
      throw new Error("Wrong phase");
    }
    if (this.state.topicRound >= this.state.configuredTopicRounds) {
      this.state.phase = "GAME_RESULTS";
      this.state.gameOver = true;
      bump(this.state);
      return;
    }
    this.state.partyPrompt = null;
    await this.beginTopicSelection();
  }

  handleEndGame(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    this.state.phase = "GAME_RESULTS";
    this.state.gameOver = true;
    bump(this.state);
    void this.clearAlarm();
  }

  async handlePlayAgain(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    const code = this.state.code;
    const settings = this.state.settings;
    const names = this.state.players.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      connected: p.connected,
    }));
    this.state = emptyRoomState(code);
    this.state.settings = settings;
    this.state.players = names.map((n, i) => ({
      id: n.id,
      name: n.name,
      stones: RULES.startBalance,
      connected: n.connected,
      isHost: i === 0,
      role: n.role === "spectator" ? "player" : n.role,
      seat: null,
      joinedAt: Date.now(),
    }));
    // Re-promote first connected as host
    this.ensureHost();
    bump(this.state);
    await this.clearAlarm();
  }

  handleVoidTopic(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    if (!this.state.checkpoint) throw new Error("No checkpoint");
    if (!this.state.scoresLocked && this.state.phase !== "DICE") {
      throw new Error("Void only after scores locked");
    }
    for (const p of this.state.players) {
      if (p.id in this.state.checkpoint.stones) {
        p.stones = this.state.checkpoint.stones[p.id]!;
      }
    }
    this.state.notice = "Round discarded. Beans restored.";
    this.state.partyPrompt = null;
    void this.beginTopicSelection();
  }

  async onPhaseTimeout() {
    switch (this.state.phase) {
      case "TOPIC_SELECTION":
        await this.tallyTopicVotes();
        break;
      case "PREP":
        await this.beginDraft();
        break;
      case "REVIEW":
        await this.beginVoting();
        break;
      case "VOTING_AND_JUDGING":
        await this.finalizeScores();
        break;
      default:
        break;
    }
  }

  async checkHostFailover() {
    const elapsed = Date.now() - this.state.hostLastSeenAt;
    if (elapsed > RULES.hostFailoverSeconds * 1000) {
      const host = this.state.players.find((p) => p.isHost);
      if (host && !host.connected) {
        this.ensureHost();
      }
    }
  }
}

QuarryServer satisfies Party.Worker;
