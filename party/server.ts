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
  type Phase,
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
  bankPotIntoProtected,
  buildAnonymousRosters,
  classifyPullOut,
  diceAnimWindow,
  judgeRequestPayload,
  neutralJudgments,
  newRollId,
  projectPublicState,
  roll2d6,
  rosterFull,
  snakeDraftOrder,
  takenFromPicks,
  upsertDraftPick,
  validateAndMapJudgments,
} from "../src/shared/engine";
function roomEnv(room: Party.Room): Record<string, string | undefined> {
  return (
    (room as unknown as { env?: Record<string, string | undefined> }).env ?? {}
  );
}

/** Strip HTTP codes / secrets from judge notices before players see them. */
function sanitizeJudgeNotice(notice: string): string {
  if (!notice) return RULES.aiFallbackLabel;
  if (/HTTP\s*\d{3}|\b5\d{2}\b|\b429\b|JUDGE_SECRET|API_KEY|Gemini|OpenAI/i.test(notice)) {
    return RULES.aiFallbackLabel;
  }
  // Keep short human notices like "No topic — neutral award."
  if (notice.length > 80) return RULES.aiFallbackLabel;
  return notice;
}

/** Normalize persisted state after schema additions. */
function migrateState(raw: RoomState): RoomState {
  const base = emptyRoomState(raw.code || "ROOM");
  const legacy = raw as RoomState & {
    diceLapsCompleted?: number;
    diceBanksCompleted?: number;
  };
  // PREP phase removed — resume into draft if an old room was mid-prep.
  const legacyPhase = raw.phase as string;
  const phase =
    legacyPhase === "PREP" ? ("DRAFT" as RoomState["phase"]) : raw.phase;
  return {
    ...base,
    ...raw,
    phase,
    configuredTopicRounds:
      raw.configuredTopicRounds ?? base.configuredTopicRounds,
    judgeStatus: raw.judgeStatus ?? "idle",
    judgeJobId: raw.judgeJobId ?? null,
    judgeNotice: raw.judgeNotice ?? null,
    topicVotes: raw.topicVotes ?? {},
    humanVotes: raw.humanVotes ?? {},
    processedActionIds: raw.processedActionIds ?? [],
    draftOptions: raw.draftOptions ?? [],
    draftOptionsStatus: raw.draftOptionsStatus ?? "idle",
    draftOptionsJobId: raw.draftOptionsJobId ?? null,
    bankBeansReady: raw.bankBeansReady ?? {},
    diceLapsCompleted:
      legacy.diceLapsCompleted ?? legacy.diceBanksCompleted ?? 0,
  };
}

type AlarmKind =
  | "phase"
  | "pick"
  | "wager"
  | "dice_decision"
  | "dice_idle"
  | "dice_anim"
  | "dice_settle_hold"
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

const ADMIN_PIN = "8989";
const BOT_NAMES = [
  "Ava",
  "Sam",
  "Kai",
  "Remy",
  "Jules",
  "Quinn",
  "Noah",
  "Eli",
];

function assertAdminPin(pin: string) {
  if (pin !== ADMIN_PIN) throw new Error("Nope");
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

  async onStart() {
    const saved = await this.room.storage.get<RoomState>("state");
    const alarm = await this.room.storage.get<AlarmPayload>("alarm");
    const wasPrep = saved ? (saved.phase as string) === "PREP" : false;
    if (saved) {
      this.state = migrateState(saved);
      this.state.players = this.state.players.map((p) =>
        p.role === "spectator" ? p : { ...p, connected: false },
      );
    }
    if (alarm) this.alarmPayload = alarm;
    // Old PREP rooms: ensure draft clocks exist after migration.
    if (
      wasPrep &&
      this.state.phase === "DRAFT" &&
      this.state.draftOrder.length === 0
    ) {
      await this.beginDraft();
      await this.persist();
    }
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
      case "dice_settle_hold":
        await this.afterDiceSettleHold();
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
      // Prefer short game-rule messages; never leak stacks / infra to clients.
      const text = e instanceof Error ? e.message : "Something went wrong — try again";
      const safe =
        !text ||
        text.length > 120 ||
        /partykit|stack|TypeError|at\s+\S+|ECONN|JUDGE_SECRET|API_KEY/i.test(
          text,
        )
          ? "Something went wrong — try again"
          : text;
      this.send(sender, { type: "error", message: safe });
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
      case "bank_the_beans":
        await this.handleBankTheBeans(id);
        return;
      case "advance":
        await this.handleAdvance(id);
        return;
      case "dice_ready_ack":
        return;
      case "admin_spawn_bots":
        this.handleAdminSpawnBots(msg.pin, msg.count);
        return;
      case "admin_jump_phase":
        await this.handleAdminJumpPhase(msg.pin, msg.phase);
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
    this.state.topicRerollsUsed = 0;
    this.state.scores = [];
    this.state.scoresLocked = false;
    this.state.judgeStatus = "idle";
    this.state.judgeJobId = null;
    this.state.judgeNotice = null;
    this.state.earnedThisRound = {};
    this.state.wagers = {};
    this.state.humanVotes = {};
    this.state.picks = [];
    this.state.takenNormalized = [];
    this.state.draftCursor = 0;
    this.state.notice = null;
    bump(this.state);
    this.spinShortlist();
    // No topic timer — players pick calmly; advances when all have voted.
    this.state.phaseDeadlineAt = null;
    await this.clearAlarm();
  }

  spinShortlist() {
    const count = topicShortlistCount();
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
    // Host can spin anytime; any seated player may reroll as needed (unlimited).
    if (!isReroll && !this.requireHost(id)) throw new Error("Host only");
    if (isReroll && !this.requirePlayer(id)) throw new Error("Players only");
    if (this.state.phase !== "TOPIC_SELECTION") throw new Error("Wrong phase");
    if (isReroll) {
      this.state.topicRerollsUsed += 1;
    }
    this.spinShortlist();
    bump(this.state);
    // Reroll does not start a countdown either.
    this.state.phaseDeadlineAt = null;
    await this.clearAlarm();
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
    // Players type their own answers — no shared suggestion catalog.
    this.state.draftOptions = [];
    this.state.draftOptionsStatus = "idle";
    this.state.draftOptionsJobId = null;
    bump(this.state);
    // Topic locked → straight into draft (no prep countdown).
    await this.beginDraft();
  }

  async beginDraft() {
    const n = this.state.seatOrder.length;
    this.state.draftOrder = snakeDraftOrder(n, RULES.picksPerPlayer, this.state.starterOffset);
    this.state.draftCursor = 0;
    this.state.picks = [];
    this.state.takenNormalized = [];
    this.state.phase = "DRAFT";
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

    if (this.state.phase === "CORRECTION") {
      await this.applyCorrectionLockIn(id, clean);
      return;
    }

    // Normal draft — never overwrite an already-filled turn; never exceed 4.
    if (this.state.picks.some((p) => p.turnIndex === this.state.draftCursor)) {
      throw new Error("Slot already filled");
    }
    if (rosterFull(this.state.picks, id)) {
      throw new Error("Roster full");
    }

    const pickIndex = this.state.picks.filter((p) => p.playerId === id).length;
    this.state.picks = upsertDraftPick(this.state.picks, {
      playerId: id,
      text: clean,
      pickIndex,
      turnIndex: this.state.draftCursor,
    });
    this.state.takenNormalized = takenFromPicks(
      this.state.picks,
      normalizePick,
    );
    this.state.draftCursor += 1;
    bump(this.state);

    if (this.state.draftCursor >= this.state.draftOrder.length) {
      await this.beginReview();
    } else {
      await this.startPickClock();
    }
  }

  /** Replace the corrected slot, then resume prior draft cursor or REVIEW. */
  async applyCorrectionLockIn(id: string, clean: string) {
    const turnIndex = Number(this.state.correctionTargetPickId);
    if (!Number.isInteger(turnIndex) || turnIndex < 0) {
      throw new Error("No redo target");
    }
    const pickIndex =
      this.state.correctionPickIndex ??
      Math.min(
        this.state.picks.filter((p) => p.playerId === id).length,
        RULES.picksPerPlayer - 1,
      );

    this.state.picks = upsertDraftPick(this.state.picks, {
      playerId: id,
      text: clean,
      pickIndex,
      turnIndex,
    });
    this.state.takenNormalized = takenFromPicks(
      this.state.picks,
      normalizePick,
    );

    const resumeCursor =
      this.state.correctionResumeCursor ?? this.state.draftOrder.length;
    const returnPhase = this.state.correctionReturnPhase ?? "REVIEW";

    this.state.correctionReason = null;
    this.state.correctionTargetPickId = null;
    this.state.correctionPickIndex = null;
    this.state.correctionResumeCursor = null;
    this.state.correctionReturnPhase = null;

    if (
      returnPhase === "DRAFT" &&
      resumeCursor < this.state.draftOrder.length
    ) {
      this.state.phase = "DRAFT";
      this.state.draftCursor = resumeCursor;
      bump(this.state);
      await this.startPickClock();
      return;
    }

    this.state.draftCursor = this.state.draftOrder.length;
    bump(this.state);
    await this.beginReview();
  }

  async onPickTimeout() {
    if (this.state.phase !== "DRAFT" && this.state.phase !== "CORRECTION") return;
    if (this.state.pickPaused) return;
    const pid = this.currentDraftPlayerId();
    if (!pid) return;

    if (this.state.phase === "CORRECTION") {
      const miss = `Missed pick (${(this.state.correctionPickIndex ?? 0) + 1})`;
      await this.applyCorrectionLockIn(pid, miss);
      this.state.notice = `Clock expired — missed redo for ${
        this.state.players.find((p) => p.id === pid)?.name ?? "player"
      }`;
      await this.persist();
      return;
    }

    // Never append past 4 or overwrite a filled turn.
    if (
      this.state.picks.some((p) => p.turnIndex === this.state.draftCursor) ||
      rosterFull(this.state.picks, pid)
    ) {
      this.state.draftCursor += 1;
      bump(this.state);
      if (this.state.draftCursor >= this.state.draftOrder.length) {
        await this.beginReview();
      } else {
        await this.startPickClock();
        await this.persist();
      }
      return;
    }

    const miss = `Missed pick (${this.state.draftCursor + 1})`;
    const pickIndex = this.state.picks.filter((p) => p.playerId === pid).length;
    this.state.picks = upsertDraftPick(this.state.picks, {
      playerId: pid,
      text: miss,
      pickIndex,
      turnIndex: this.state.draftCursor,
    });
    this.state.takenNormalized = takenFromPicks(
      this.state.picks,
      normalizePick,
    );
    this.state.notice = `Clock expired — missed pick for ${
      this.state.players.find((p) => p.id === pid)?.name ?? "player"
    }`;
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
    if (this.state.phase === "CORRECTION") {
      throw new Error("Finish the current redo first");
    }
    const pick = this.state.picks.find((p) => p.turnIndex === turnIndex);
    if (!pick) throw new Error("Pick not found");

    const priorPhase = this.state.phase;
    const priorCursor = this.state.draftCursor;

    // Remove only this turn's pick (keep the player's other slots intact).
    this.state.picks = this.state.picks.filter((p) => p.turnIndex !== turnIndex);
    this.state.takenNormalized = takenFromPicks(
      this.state.picks,
      normalizePick,
    );

    if (this.state.scoresLocked) {
      throw new Error("Scores locked — finish the round");
    }

    if (
      priorPhase === "VOTING_AND_JUDGING" ||
      priorPhase === "REVIEW" ||
      Object.keys(this.state.humanVotes).length > 0
    ) {
      this.state.humanVotes = {};
      this.state.scores = [];
      this.state.scoresLocked = false;
    }

    const draftStillOpen =
      priorPhase === "DRAFT" && priorCursor < this.state.draftOrder.length;

    this.state.phase = "CORRECTION";
    this.state.correctionReason = reason;
    this.state.correctionTargetPickId = String(turnIndex);
    this.state.correctionPickIndex = pick.pickIndex;
    this.state.correctionResumeCursor = draftStillOpen
      ? priorCursor
      : this.state.draftOrder.length;
    this.state.correctionReturnPhase = draftStillOpen ? "DRAFT" : "REVIEW";
    this.state.draftCursor = turnIndex;
    bump(this.state);
    this.state.pickPaused = false;
    await this.startPickClock();
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
    this.state.bankBeansReady = {};
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
        this.applyJudgeFallback(jobId, RULES.aiFallbackLabel);
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
        this.applyJudgeFallback(jobId, RULES.aiFallbackLabel);
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
      this.applyJudgeFallback(jobId, RULES.aiFallbackLabel);
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
    // Never show raw HTTP / model errors to players.
    this.state.judgeNotice = sanitizeJudgeNotice(notice);
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
    if (this.state.seatOrder.length === 2) {
      throw new Error("Two-player games use the AI judge");
    }
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

    const votes =
      this.state.seatOrder.length === 2 ? {} : this.state.humanVotes;
    this.state.scores = applyVoteCounts(this.state.scores, votes);
    this.state.earnedThisRound = Object.fromEntries(
      this.state.scores.map((s) => [s.playerId, s.earned]),
    );
    this.state.scoresLocked = true;
    this.state.phase = "SCORE_REVEAL";
    this.state.phaseDeadlineAt = null;
    this.state.bankBeansReady = {};
    // Bots auto-ready so admin tables aren't stuck waiting on fakes.
    for (const p of seatedPlayers(this.state)) {
      if (p.id.startsWith("bot-")) this.state.bankBeansReady[p.id] = true;
    }
    await this.clearAlarm();
    bump(this.state);
  }

  async handleBankTheBeans(id: string) {
    if (!this.requirePlayer(id)) throw new Error("Players only");
    if (this.state.phase !== "SCORE_REVEAL") throw new Error("Wrong phase");
    this.state.bankBeansReady[id] = true;
    for (const p of seatedPlayers(this.state)) {
      if (p.id.startsWith("bot-")) this.state.bankBeansReady[p.id] = true;
    }
    bump(this.state);
    await this.maybeBeginWagersFromReady();
  }

  async maybeBeginWagersFromReady() {
    if (this.state.phase !== "SCORE_REVEAL") return;
    const needed = seatedPlayers(this.state);
    if (needed.length === 0) return;
    if (needed.every((p) => this.state.bankBeansReady[p.id])) {
      await this.beginWagers();
    }
  }

  async handleAdvance(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    switch (this.state.phase) {
      case "SCORE_REVEAL":
        // Host can force-advance (admin / stuck table) — still goes to wager, not topic.
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
    this.state.bankBeansReady = {};
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
    const W = applyWager({ banked: B, earned: E, wager: amount }).pot;
    this.state.wagers[id] = W;

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
      // Everyone re-enters dice each topic, including zero wagers.
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
    // Skip inactive seats (banked / busted)
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

  /** Advance to the next seat after the current player banks or busts. */
  advanceDiceSeat() {
    const n = this.state.seatOrder.length;
    if (n === 0) return;
    const prev = this.state.diceTurnSeat;
    this.state.diceTurnSeat = (this.state.diceTurnSeat + 1) % n;
    if (this.state.diceTurnSeat <= prev) {
      this.state.diceLapsCompleted += 1;
    }
  }

  /** Same player keeps rolling — skip decision countdown, unlock Roll. */
  async continueSamePlayerTurn() {
    this.state.diceSubphase = "READY";
    this.state.diceDecisionDeadlineAt = null;
    this.state.diceIdleDeadlineAt =
      Date.now() + RULES.diceIdleBankSeconds * 1000;
    await this.setAlarmAt(this.state.diceIdleDeadlineAt, {
      kind: "dice_idle",
      revision: this.state.phaseRevision,
    });
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
        note: "BEAN BUSTER",
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
    const busted = this.state.lastDice?.busted === true;
    this.revealCommittedDice();

    if (this.state.diceActiveIds.length === 0) {
      // Brief beat so BEAN BUSTER faces land before leaving the table.
      bump(this.state);
      await this.setAlarmAt(Date.now() + RULES.diceSettleHoldMs, {
        kind: "dice_settle_hold",
        revision: this.state.phaseRevision,
        meta: "round_end",
      });
      return;
    }

    // Hold authoritative faces on screen — then READY or next seat.
    bump(this.state);
    await this.setAlarmAt(Date.now() + RULES.diceSettleHoldMs, {
      kind: "dice_settle_hold",
      revision: this.state.phaseRevision,
      meta: busted ? "bust" : "continue",
    });
  }

  async afterDiceSettleHold() {
    if (this.state.phase !== "DICE") return;
    if (this.state.diceSubphase !== "SETTLED") return;

    if (this.state.diceActiveIds.length === 0) {
      await this.beginRoundResults();
      return;
    }

    const busted = this.state.lastDice?.busted === true;
    if (busted) {
      this.advanceDiceSeat();
      await this.startDiceTurn();
    } else {
      await this.continueSamePlayerTurn();
    }
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

  handleAdminSpawnBots(pin: string, count: number) {
    assertAdminPin(pin);
    const n = Math.max(1, Math.min(8, Math.floor(count) || 1));
    const existingBots = this.state.players.filter((p) =>
      p.id.startsWith("bot-"),
    ).length;
    let added = 0;
    for (let i = 0; i < n; i++) {
      const players = this.state.players.filter((p) => p.role === "player");
      if (players.length >= RULES.maxPlayers) break;
      if (this.state.rosterLocked) {
        // Mid-game: only add if we can append to seat order (debug only).
        // Prefer adding before lock; if locked, still inject for testing.
      }
      const idx = existingBots + added;
      const name = `Bot ${BOT_NAMES[idx % BOT_NAMES.length]}${idx >= BOT_NAMES.length ? idx : ""}`;
      const id = `bot-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      const isFirst = players.length === 0;
      this.state.players.push({
        id,
        name,
        stones: RULES.startBalance,
        connected: true,
        isHost: isFirst,
        role: "player",
        seat: null,
        joinedAt: Date.now(),
      });
      if (this.state.rosterLocked) {
        const seat = this.state.seatOrder.length;
        const p = this.state.players.find((x) => x.id === id)!;
        p.seat = seat;
        this.state.seatOrder.push(id);
        this.state.earnedThisRound[id] = this.state.earnedThisRound[id] ?? 20;
        this.state.pots[id] = this.state.pots[id] ?? 0;
        this.state.protectedStones[id] =
          this.state.protectedStones[id] ?? p.stones;
        this.state.personalRollCounts[id] = 0;
        if (
          this.state.phase === "DICE" &&
          !this.state.diceActiveIds.includes(id)
        ) {
          this.state.diceActiveIds.push(id);
        }
      }
      added += 1;
    }
    this.state.notice = added
      ? `Admin · added ${added} fake player${added === 1 ? "" : "s"}`
      : "Admin · room full";
    bump(this.state);
  }

  async handleAdminJumpPhase(pin: string, phase: Phase) {
    assertAdminPin(pin);
    await this.adminEnsureRoster();
    await this.clearAlarm();
    this.state.notice = `Admin · jumped to ${phase}`;
    this.state.partyPrompt = null;
    this.state.pickPaused = false;

    switch (phase) {
      case "LOBBY":
        this.state.phase = "LOBBY";
        this.state.rosterLocked = false;
        this.state.seatOrder = [];
        this.state.players = this.state.players.map((p) => ({
          ...p,
          seat: null,
        }));
        this.state.phaseDeadlineAt = null;
        bump(this.state);
        return;
      case "TOPIC_SELECTION":
        await this.beginTopicSelection();
        return;
      case "DRAFT":
        await this.adminEnsureTopic();
        await this.beginDraft();
        return;
      case "CORRECTION":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.state.phase = "CORRECTION";
        this.state.correctionReason = "invalid";
        this.state.draftCursor = 0;
        bump(this.state);
        await this.startPickClock();
        return;
      case "REVIEW":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.state.phase = "REVIEW";
        this.state.phaseDeadlineAt =
          Date.now() + RULES.reviewSeconds * 1000;
        bump(this.state);
        await this.setAlarmAt(this.state.phaseDeadlineAt, {
          kind: "phase",
          revision: this.state.phaseRevision,
        });
        return;
      case "VOTING_AND_JUDGING":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.state.humanVotes = {};
        this.state.scores = [];
        this.state.scoresLocked = false;
        this.state.judgeStatus = "idle";
        this.state.judgeNotice = null;
        this.state.phase = "VOTING_AND_JUDGING";
        this.state.phaseDeadlineAt =
          Date.now() + RULES.humanVoteSeconds * 1000;
        this.adminSeedVoteWhys();
        bump(this.state);
        await this.setAlarmAt(this.state.phaseDeadlineAt, {
          kind: "phase",
          revision: this.state.phaseRevision,
        });
        return;
      case "SCORE_REVEAL":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.adminFillScores();
        this.state.phase = "SCORE_REVEAL";
        this.state.scoresLocked = true;
        this.state.judgeStatus = "ready";
        this.state.judgeNotice = null;
        this.state.phaseDeadlineAt = null;
        this.state.bankBeansReady = {};
        for (const p of seatedPlayers(this.state)) {
          if (p.id.startsWith("bot-")) this.state.bankBeansReady[p.id] = true;
        }
        bump(this.state);
        return;
      case "WAGER_SELECTION":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.adminFillScores();
        await this.beginWagers();
        return;
      case "DICE":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.adminFillScores();
        this.adminSeedDice();
        await this.beginDice();
        // Skip cooldown for faster testing
        await this.unlockRoll();
        return;
      case "ROUND_RESULTS":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.adminFillScores();
        this.state.phase = "ROUND_RESULTS";
        this.state.diceSubphase = "SETTLED";
        this.state.phaseDeadlineAt = null;
        bump(this.state);
        return;
      case "GAME_RESULTS":
        await this.adminEnsureTopic();
        await this.adminFillPicks();
        this.adminFillScores();
        this.state.phase = "GAME_RESULTS";
        this.state.gameOver = true;
        this.state.phaseDeadlineAt = null;
        bump(this.state);
        return;
      default:
        throw new Error("Unknown phase");
    }
  }

  async adminEnsureRoster() {
    // Need at least 2 players for most phases
    while (
      this.state.players.filter((p) => p.role === "player").length <
      RULES.minPlayers
    ) {
      this.handleAdminSpawnBots(ADMIN_PIN, 1);
    }
    if (!this.state.rosterLocked || this.state.seatOrder.length === 0) {
      const hopeful = this.state.players.filter((p) => p.role === "player");
      const shuffled = [...hopeful];
      this.state.players = this.state.players.map((p) => {
        if (p.role !== "player") return { ...p, seat: null };
        const idx = shuffled.findIndex((s) => s.id === p.id);
        return { ...p, seat: idx };
      });
      this.state.seatOrder = shuffled.map((p) => p.id);
      this.state.rosterLocked = true;
      this.state.starterOffset = 0;
      this.state.topicRound = Math.max(0, this.state.topicRound);
      this.state.configuredTopicRounds = topicRoundsForPlayerCount(
        shuffled.length,
      );
      this.state.checkpoint = {
        stones: Object.fromEntries(
          seatedPlayers(this.state).map((p) => [p.id, p.stones]),
        ),
        topicRound: this.state.topicRound,
      };
    }
  }

  async adminEnsureTopic() {
    if (!this.state.selectedTopic) {
      this.spinShortlist();
      const opt = this.state.topicOptions[0];
      if (!opt) throw new Error("No topics");
      this.state.selectedTopic = opt;
      if (!opt.isCustom) this.state.usedTopicIds.push(opt.id);
    }
  }

  async adminFillPicks() {
    const fillers = [
      "Coffee",
      "Rain",
      "Dogs",
      "Pizza",
      "Sunrise",
      "Vinyl",
      "Maps",
      "Socks",
    ];
    let turn = 0;
    for (let pass = 0; pass < RULES.picksPerPlayer; pass++) {
      for (const pid of this.state.seatOrder) {
        const have = this.state.picks.filter((p) => p.playerId === pid).length;
        if (have > pass) {
          turn += 1;
          continue;
        }
        const text = `${fillers[(turn + pass) % fillers.length]} ${pass + 1}`;
        const norm = normalizePick(text);
        if (!this.state.takenNormalized.includes(norm)) {
          this.state.takenNormalized.push(norm);
        }
        this.state.picks.push({
          playerId: pid,
          text,
          pickIndex: pass,
          turnIndex: turn,
        });
        turn += 1;
      }
    }
    this.state.draftOrder = snakeDraftOrder(
      this.state.seatOrder.length,
      RULES.picksPerPlayer,
      this.state.starterOffset,
    );
    this.state.draftCursor = this.state.draftOrder.length;
  }

  adminFillScores() {
    const picksByPlayer: Record<string, string[]> = {};
    for (const pid of this.state.seatOrder) {
      picksByPlayer[pid] = this.state.picks
        .filter((pk) => pk.playerId === pid)
        .sort((a, b) => a.pickIndex - b.pickIndex)
        .map((pk) => pk.text);
    }
    const rosters = buildAnonymousRosters(this.state.seatOrder, picksByPlayer);
    const sampleWhys = [
      "Sharp range and clear topic fit — memorable Mount Rushmore.",
      "Solid variety with a few stretches; still fun to debate.",
      "Cohesive list that leans hard into the theme.",
      "Playful picks with good contrast across the four slots.",
    ];
    this.state.scores = neutralJudgments(rosters).map((s, i) => ({
      ...s,
      explanation: sampleWhys[i % sampleWhys.length]!,
      aiFallback: false,
      earned: 20 + (s.aiAward ?? 20),
      votes: i === 0 ? 1 : 0,
    }));
    this.state.earnedThisRound = Object.fromEntries(
      this.state.scores.map((s) => [s.playerId, s.earned]),
    );
    this.state.scoresLocked = true;
    this.state.judgeStatus = "ready";
    this.state.judgeNotice = null;
  }
  adminSeedVoteWhys() {
    if (this.state.scores.length > 0) return;
    const picksByPlayer: Record<string, string[]> = {};
    for (const pid of this.state.seatOrder) {
      picksByPlayer[pid] = this.state.picks
        .filter((pk) => pk.playerId === pid)
        .sort((a, b) => a.pickIndex - b.pickIndex)
        .map((pk) => pk.text);
    }
    const rosters = buildAnonymousRosters(this.state.seatOrder, picksByPlayer);
    const sampleWhys = [
      "Sharp range and clear topic fit — memorable Mount Rushmore.",
      "Solid variety with a few stretches; still fun to debate.",
      "Cohesive list that leans hard into the theme.",
      "Playful picks with good contrast across the four slots.",
    ];
    this.state.scores = neutralJudgments(rosters).map((s, i) => ({
      ...s,
      explanation: sampleWhys[i % sampleWhys.length]!,
      aiFallback: false,
      earned: 0,
      votes: 0,
    }));
    this.state.scoresLocked = false;
    this.state.judgeStatus = "ready";
  }

  adminSeedDice() {
    this.state.wagers = {};
    this.state.pots = {};
    this.state.protectedStones = {};
    this.state.personalRollCounts = {};
    this.state.diceActiveIds = [];
    this.state.lastDice = null;
    for (const pid of this.state.seatOrder) {
      const p = this.state.players.find((x) => x.id === pid)!;
      const E = this.state.earnedThisRound[pid] ?? 20;
      const B = p.stones;
      const W = Math.min(10, E + B);
      const locked = applyWager({ banked: B, earned: E, wager: W });
      this.state.wagers[pid] = W;
      this.state.protectedStones[pid] = locked.protected;
      this.state.pots[pid] = locked.pot;
      this.state.personalRollCounts[pid] = 0;
      p.stones = locked.bankedAfter;
      this.state.diceActiveIds.push(pid);
    }
  }

  handleVoidTopic(id: string) {
    if (!this.requireHost(id)) throw new Error("Host only");
    // After voting/scoring, topic is a required step — no void/skip escape.
    if (
      this.state.scoresLocked ||
      this.state.phase === "SCORE_REVEAL" ||
      this.state.phase === "WAGER_SELECTION" ||
      this.state.phase === "DICE" ||
      this.state.phase === "ROUND_RESULTS" ||
      this.state.phase === "VOTING_AND_JUDGING"
    ) {
      throw new Error("Topic is required — finish the round");
    }
    throw new Error("Cannot void topic now");
  }

  async onPhaseTimeout() {
    switch (this.state.phase) {
      case "TOPIC_SELECTION":
        // No auto-advance — topic pick has no timer.
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
