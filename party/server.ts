import type * as Party from "partykit/server";
import {
  BANK_ACTIONS,
  CATEGORY_PRESETS,
  MIN_PLAYERS,
  STARTING_CHIPS,
  type BankAction,
  type BankResult,
  type BankWager,
  type ClientMessage,
  type Player,
  type RoomState,
  type ServerMessage,
} from "../src/shared/types";

const BOT_ID = "bot-rushbot";

function emptyState(code: string): RoomState {
  return {
    code,
    phase: "lobby",
    players: [],
    pot: 0,
    round: 0,
    category: null,
    categoryVotes: {},
    submissions: [],
    rankings: [],
    bankWagers: [],
    bankResult: null,
    lastRushmoreScores: {},
    categoryPickerId: null,
    createdAt: Date.now(),
  };
}

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function connectedHumans(state: RoomState): Player[] {
  return state.players.filter((p) => p.connected && !p.isBot);
}

function activePlayers(state: RoomState): Player[] {
  return state.players.filter((p) => p.connected || p.isBot);
}

/** Heuristic Rushmore for the bot when no AI key is used client-side. */
function botRushmore(category: string): [string, string, string, string] {
  const c = category.toLowerCase();
  if (c.includes("pizza")) {
    return ["Pepperoni", "Mushroom", "Hot honey", "Extra cheese"];
  }
  if (c.includes("marvel")) {
    return [
      "Spider-Man: No Way Home",
      "Iron Man",
      "Guardians Vol. 2",
      "Black Panther",
    ];
  }
  if (c.includes("chore")) {
    return ["Dishes", "Laundry", "Bathroom scrub", "Taking out trash"];
  }
  if (c.includes("snack")) {
    return ["Chips & guac", "Gummy bears", "Trail mix", "Cheese sticks"];
  }
  if (c.includes("music")) {
    return ["90s", "70s", "2010s", "80s"];
  }
  const words = category
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const base = words[words.length - 1] || "Pick";
  return [
    `Peak ${base}`,
    `Solid ${base}`,
    `Underrated ${base}`,
    `Wildcard ${base}`,
  ];
}

function botRationale(category: string): string {
  const lines = [
    `This Mount has the strongest vibe for "${category}" — cohesive and spicy.`,
    `Clean hierarchy. The #1 pick actually earns the stone face.`,
    `I'd defend this Rushmore at a bar. The bottom two still slap.`,
    `Balanced takes, zero chaos bait. Judges respect consistency.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export default class RushmoreBankServer implements Party.Server {
  state: RoomState;

  constructor(readonly room: Party.Room) {
    this.state = emptyState(room.id.toUpperCase());
  }

  async onStart() {
    const saved = await this.room.storage.get<RoomState>("state");
    if (saved) {
      this.state = saved;
      // Mark everyone disconnected until they reconnect
      this.state.players = this.state.players.map((p) =>
        p.isBot ? p : { ...p, connected: false },
      );
    }
  }

  async persist() {
    await this.room.storage.put("state", this.state);
  }

  send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  broadcastState() {
    for (const conn of this.room.getConnections()) {
      this.send(conn, {
        type: "state",
        state: this.state,
        youId: conn.id,
      });
    }
  }

  ensureHost() {
    const humans = this.state.players.filter((p) => !p.isBot && p.connected);
    if (humans.length === 0) return;
    if (!this.state.players.some((p) => p.isHost && p.connected && !p.isBot)) {
      this.state.players = this.state.players.map((p) => ({
        ...p,
        isHost: p.id === humans[0].id,
      }));
    }
  }

  onConnect(conn: Party.Connection) {
    // Rejoin existing player slot if same connection id was stored (rare);
    // normally clients join via "join" message with a stable player id in query.
    const playerId = (conn as Party.Connection & { id: string }).id;
    const existing = this.state.players.find((p) => p.id === playerId);
    if (existing) {
      existing.connected = true;
      this.ensureHost();
      void this.persist();
    }
    this.send(conn, {
      type: "state",
      state: this.state,
      youId: playerId,
    });
  }

  onClose(conn: Party.Connection) {
    const p = this.state.players.find((x) => x.id === conn.id);
    if (p && !p.isBot) {
      p.connected = false;
      if (p.isHost) {
        p.isHost = false;
        this.ensureHost();
      }
      void this.persist();
      this.broadcastState();
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    let data: ClientMessage;
    try {
      data = JSON.parse(message) as ClientMessage;
    } catch {
      this.send(sender, { type: "error", message: "Bad message" });
      return;
    }

    try {
      await this.handle(data, sender);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      this.send(sender, { type: "error", message: msg });
    }
  }

  async handle(data: ClientMessage, sender: Party.Connection) {
    switch (data.type) {
      case "join":
        this.handleJoin(sender, data.name);
        break;
      case "start":
        this.requireHost(sender);
        this.startCategoryPhase();
        break;
      case "vote_category":
        this.handleVoteCategory(sender, data.category);
        break;
      case "pick_category":
        this.handlePickCategory(sender, data.category);
        break;
      case "submit_rushmore":
        this.handleSubmitRushmore(sender, data.items);
        break;
      case "submit_ranking":
        this.handleSubmitRanking(sender, data.orderedPlayerIds, data.rationale);
        break;
      case "submit_bank":
        this.handleSubmitBank(sender, data.action, data.amount);
        break;
      case "roll_bank":
        this.requireHost(sender);
        this.resolveBank();
        break;
      case "advance":
        this.requireHost(sender);
        this.advance();
        break;
      case "add_bot":
        this.requireHost(sender);
        this.addBot();
        break;
      default:
        this.send(sender, { type: "error", message: "Unknown action" });
        return;
    }
    await this.persist();
    this.broadcastState();
  }

  requireHost(sender: Party.Connection) {
    const p = this.state.players.find((x) => x.id === sender.id);
    if (!p?.isHost) throw new Error("Only the host can do that");
  }

  handleJoin(sender: Party.Connection, name: string) {
    const clean = name.trim().slice(0, 18);
    if (!clean) throw new Error("Enter a display name");

    const existing = this.state.players.find((p) => p.id === sender.id);
    if (existing) {
      existing.name = clean;
      existing.connected = true;
      this.ensureHost();
      return;
    }

    // Late join mid-game: allowed into lobby-like spectate chips, can play next round
    const isFirstHuman = connectedHumans(this.state).length === 0;
    const player: Player = {
      id: sender.id,
      name: clean,
      chips: STARTING_CHIPS,
      connected: true,
      isHost: isFirstHuman,
      isBot: false,
      doubleJudge: false,
      hasRematchToken: false,
    };
    this.state.players.push(player);
    this.ensureHost();
  }

  addBot() {
    if (this.state.players.some((p) => p.isBot)) {
      throw new Error("RushBot is already in the room");
    }
    this.state.players.push({
      id: BOT_ID,
      name: "RushBot",
      chips: STARTING_CHIPS,
      connected: true,
      isHost: false,
      isBot: true,
      doubleJudge: false,
      hasRematchToken: false,
    });
    // If mid-phase, bot auto-acts
    this.maybeBotAct();
  }

  startCategoryPhase() {
    if (activePlayers(this.state).length < MIN_PLAYERS) {
      throw new Error(`Need at least ${MIN_PLAYERS} players (add RushBot?)`);
    }
    this.state.phase = "category";
    this.state.round += 1;
    this.state.category = null;
    this.state.categoryVotes = {};
    this.state.submissions = [];
    this.state.rankings = [];
    this.state.bankWagers = [];
    this.state.bankResult = null;
    this.state.lastRushmoreScores = {};

    // Clear spent rematch after it's used to force picker
    if (this.state.categoryPickerId) {
      // picker must pick — others wait
    }
    this.maybeBotAct();
  }

  handleVoteCategory(sender: Party.Connection, category: string) {
    if (this.state.phase !== "category") throw new Error("Not voting now");
    if (this.state.categoryPickerId) {
      throw new Error("Someone holds the rematch token — they pick");
    }
    const cat = category.trim().slice(0, 80);
    if (!cat) throw new Error("Pick a category");
    this.state.categoryVotes[sender.id] = cat;

    const voters = activePlayers(this.state).filter((p) => !p.isBot);
    const allVoted = voters.every((p) => this.state.categoryVotes[p.id]);
    if (allVoted && voters.length > 0) {
      this.tallyCategoryVotes();
    }
    this.maybeBotAct();
  }

  handlePickCategory(sender: Party.Connection, category: string) {
    if (this.state.phase !== "category") throw new Error("Not picking now");
    const cat = category.trim().slice(0, 80);
    if (!cat) throw new Error("Enter a category");

    const picker = this.state.categoryPickerId;
    const player = this.state.players.find((p) => p.id === sender.id);
    if (picker) {
      if (sender.id !== picker) throw new Error("Rematch token holder picks");
    } else if (!player?.isHost) {
      // Host can force-pick to speed up
      throw new Error("Vote or wait for host");
    }

    this.state.category = cat;
    this.state.categoryPickerId = null;
    this.state.players = this.state.players.map((p) => ({
      ...p,
      hasRematchToken: false,
    }));
    this.state.phase = "build";
    this.maybeBotAct();
  }

  tallyCategoryVotes() {
    const counts = new Map<string, number>();
    for (const cat of Object.values(this.state.categoryVotes)) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    let best: string = CATEGORY_PRESETS[0];
    let bestN = -1;
    for (const [cat, n] of counts) {
      if (n > bestN) {
        best = cat;
        bestN = n;
      }
    }
    this.state.category = best;
    this.state.phase = "build";
    this.maybeBotAct();
  }

  handleSubmitRushmore(
    sender: Party.Connection,
    items: [string, string, string, string],
  ) {
    if (this.state.phase !== "build") throw new Error("Not building now");
    const cleaned = items.map((x) => x.trim().slice(0, 40)) as [
      string,
      string,
      string,
      string,
    ];
    if (cleaned.some((x) => !x)) throw new Error("Fill all 4 faces");
    this.upsertSubmission(sender.id, cleaned);
    this.maybeFinishBuild();
  }

  upsertSubmission(
    playerId: string,
    items: [string, string, string, string],
  ) {
    const rest = this.state.submissions.filter((s) => s.playerId !== playerId);
    rest.push({ playerId, items });
    this.state.submissions = rest;
  }

  maybeFinishBuild() {
    const need = activePlayers(this.state);
    const done = need.every((p) =>
      this.state.submissions.some((s) => s.playerId === p.id),
    );
    if (done) {
      this.state.phase = "rank";
      this.maybeBotAct();
    }
  }

  handleSubmitRanking(
    sender: Party.Connection,
    orderedPlayerIds: string[],
    rationale: string,
  ) {
    if (this.state.phase !== "rank") throw new Error("Not ranking now");
    const others = this.state.submissions
      .map((s) => s.playerId)
      .filter((id) => id !== sender.id);
    if (orderedPlayerIds.length !== others.length) {
      throw new Error("Rank everyone else's Rushmore");
    }
    for (const id of others) {
      if (!orderedPlayerIds.includes(id)) {
        throw new Error("Invalid ranking list");
      }
    }
    const text = rationale.trim().slice(0, 200);
    if (!text) throw new Error("Add a short rationale");

    const rest = this.state.rankings.filter((r) => r.judgeId !== sender.id);
    rest.push({
      judgeId: sender.id,
      orderedPlayerIds,
      rationale: text,
    });
    this.state.rankings = rest;
    this.maybeFinishRank();
  }

  maybeFinishRank() {
    const need = activePlayers(this.state);
    // Need at least 2 submissions to rank; if only 1 human + bot, both rank
    const done = need.every((p) =>
      this.state.rankings.some((r) => r.judgeId === p.id),
    );
    if (done) {
      this.scoreRushmore();
      this.state.phase = "reveal";
    }
  }

  scoreRushmore() {
    const scores: Record<string, number> = {};
    for (const sub of this.state.submissions) {
      scores[sub.playerId] = 0;
    }
    for (const ranking of this.state.rankings) {
      const judge = this.state.players.find((p) => p.id === ranking.judgeId);
      const weight = judge?.doubleJudge ? 2 : 1;
      ranking.orderedPlayerIds.forEach((pid, index) => {
        // Best rank (index 0) gets most points
        const points = (ranking.orderedPlayerIds.length - index) * weight;
        scores[pid] = (scores[pid] ?? 0) + points;
      });
    }
    this.state.lastRushmoreScores = scores;

    // Award chips: top scored +3, second +2, others +1 if they submitted
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    ranked.forEach(([pid], i) => {
      const bonus = i === 0 ? 3 : i === 1 ? 2 : 1;
      const player = this.state.players.find((p) => p.id === pid);
      if (player) player.chips += bonus;
    });

    // Clear double judge after use
    this.state.players = this.state.players.map((p) => ({
      ...p,
      doubleJudge: false,
    }));
  }

  handleSubmitBank(
    sender: Party.Connection,
    action: BankAction,
    amount: number,
  ) {
    if (this.state.phase !== "bank") throw new Error("Not banking now");
    const player = this.state.players.find((p) => p.id === sender.id);
    if (!player) throw new Error("Join first");

    const meta = BANK_ACTIONS.find((a) => a.id === action);
    if (!meta) throw new Error("Unknown wager");

    let amt = action === "skip" ? 0 : amount;
    if (amt < meta.minAmount || amt > meta.maxAmount) {
      amt = meta.defaultAmount;
    }
    if (player.chips < amt) throw new Error("Not enough chips");

    const rest = this.state.bankWagers.filter((w) => w.playerId !== sender.id);
    rest.push({ playerId: sender.id, action, amount: amt });
    this.state.bankWagers = rest;

    this.maybeBotAct();
    this.maybeAutoRollBank();
  }

  maybeAutoRollBank() {
    const need = activePlayers(this.state);
    const done = need.every((p) =>
      this.state.bankWagers.some((w) => w.playerId === p.id),
    );
    if (done) this.resolveBank();
  }

  resolveBank() {
    if (this.state.phase !== "bank") throw new Error("Not in BANK");
    for (const p of activePlayers(this.state)) {
      if (!this.state.bankWagers.some((w) => w.playerId === p.id)) {
        this.state.bankWagers.push({
          playerId: p.id,
          action: "skip",
          amount: 0,
        });
      }
    }

    const d1 = rollDie();
    const d2 = rollDie();
    const total = d1 + d2;
    let pot = this.state.pot;
    const outcomes: BankResult["outcomes"] = [];
    const chipsBefore: Record<string, number> = {};
    for (const p of this.state.players) chipsBefore[p.id] = p.chips;

    for (const w of this.state.bankWagers) {
      const player = this.state.players.find((p) => p.id === w.playerId);
      if (!player) continue;
      if (w.amount > 0) {
        const pay = Math.min(w.amount, player.chips);
        player.chips -= pay;
        pot += pay;
        w.amount = pay;
      }
    }

    const potBefore = pot;
    const doubleJudgeWinnerIds: string[] = [];
    let rematchWinnerId: string | null = null;

    for (const w of this.state.bankWagers) {
      const player = this.state.players.find((p) => p.id === w.playerId);
      if (!player) continue;
      let note = "Sat out.";

      if (w.action === "skip") {
        note = "Skipped — chips safe.";
      } else if (w.action === "pot_shot") {
        if (total >= 7) {
          const payout = Math.min(2 * w.amount, pot);
          pot -= payout;
          player.chips += payout;
          note = `Hit ${total}! Even money +${w.amount}.`;
        } else {
          note = `Rolled ${total} — pot keeps your ${w.amount}.`;
        }
      } else if (w.action === "double_judge") {
        if (total >= 8) {
          player.doubleJudge = true;
          const refund = Math.min(w.amount, pot);
          pot -= refund;
          player.chips += refund;
          doubleJudgeWinnerIds.push(player.id);
          note = `Rolled ${total}! Double Judge unlocked for next Rushmore.`;
        } else {
          note = `Needed 8+, got ${total}.`;
        }
      } else if (w.action === "rematch_token") {
        if (total >= 10) {
          rematchWinnerId = player.id;
          const refund = Math.min(w.amount, pot);
          pot -= refund;
          player.chips += refund;
          note = `Rolled ${total}! You pick the next category.`;
        } else {
          note = `Needed 10+, got ${total}.`;
        }
      } else if (w.action === "chip_heist") {
        if (total === 2 || total === 12) {
          const richest = [...this.state.players]
            .filter((p) => p.id !== player.id && (p.connected || p.isBot))
            .sort((a, b) => b.chips - a.chips)[0];
          const steal = Math.min(2, richest?.chips ?? 0);
          const refund = Math.min(w.amount, pot);
          pot -= refund;
          player.chips += refund;
          if (richest && steal > 0) {
            richest.chips -= steal;
            player.chips += steal;
            note = `HEIST! Stole ${steal} from ${richest.name}.`;
          } else {
            note = "Heist dice hit, but nobody to rob.";
          }
        } else {
          note = `Needed 2 or 12, got ${total}.`;
        }
      }

      outcomes.push({
        playerId: w.playerId,
        action: w.action,
        amount: w.amount,
        delta: player.chips - (chipsBefore[w.playerId] ?? 0),
        note,
      });
    }

    this.state.pot = Math.max(0, pot);

    if (rematchWinnerId) {
      this.state.categoryPickerId = rematchWinnerId;
      this.state.players = this.state.players.map((p) => ({
        ...p,
        hasRematchToken: p.id === rematchWinnerId,
      }));
    }

    this.state.bankResult = {
      dice: [d1, d2],
      total,
      potBefore,
      outcomes,
      rematchWinnerId,
      doubleJudgeWinnerIds,
    };
    this.state.phase = "bank_reveal";
  }

  advance() {
    switch (this.state.phase) {
      case "lobby":
        this.startCategoryPhase();
        break;
      case "category": {
        // Host can force start with leading vote or preset
        if (this.state.categoryPickerId) {
          throw new Error("Waiting on rematch token holder to pick");
        }
        if (Object.keys(this.state.categoryVotes).length > 0) {
          this.tallyCategoryVotes();
        } else {
          this.state.category = CATEGORY_PRESETS[this.state.round % CATEGORY_PRESETS.length];
          this.state.phase = "build";
          this.maybeBotAct();
        }
        break;
      }
      case "build":
        // Host force-advance: fill missing with placeholders? Better require
        throw new Error("Waiting for all Rushmores");
      case "rank":
        throw new Error("Waiting for all rankings");
      case "reveal":
        this.state.phase = "bank";
        this.state.bankWagers = [];
        this.state.bankResult = null;
        this.maybeBotAct();
        break;
      case "bank":
        this.resolveBank();
        break;
      case "bank_reveal":
        this.startCategoryPhase();
        break;
      default:
        break;
    }
  }

  maybeBotAct() {
    const bot = this.state.players.find((p) => p.isBot);
    if (!bot) return;

    if (this.state.phase === "category" && !this.state.categoryPickerId) {
      if (!this.state.categoryVotes[bot.id]) {
        const pick =
          CATEGORY_PRESETS[Math.floor(Math.random() * CATEGORY_PRESETS.length)];
        this.state.categoryVotes[bot.id] = pick;
      }
    }

    if (this.state.phase === "category" && this.state.categoryPickerId === bot.id) {
      const pick =
        CATEGORY_PRESETS[Math.floor(Math.random() * CATEGORY_PRESETS.length)];
      this.state.category = pick;
      this.state.categoryPickerId = null;
      this.state.players = this.state.players.map((p) => ({
        ...p,
        hasRematchToken: false,
      }));
      this.state.phase = "build";
    }

    if (
      this.state.phase === "build" &&
      this.state.category &&
      !this.state.submissions.some((s) => s.playerId === bot.id)
    ) {
      this.upsertSubmission(bot.id, botRushmore(this.state.category));
      this.maybeFinishBuild();
    }

    if (
      this.state.phase === "rank" &&
      !this.state.rankings.some((r) => r.judgeId === bot.id)
    ) {
      const others = this.state.submissions
        .map((s) => s.playerId)
        .filter((id) => id !== bot.id);
      // Shuffle preference
      const ordered = [...others].sort(() => Math.random() - 0.5);
      this.state.rankings.push({
        judgeId: bot.id,
        orderedPlayerIds: ordered,
        rationale: botRationale(this.state.category ?? "this category"),
      });
      this.maybeFinishRank();
    }

    if (
      this.state.phase === "bank" &&
      !this.state.bankWagers.some((w) => w.playerId === bot.id)
    ) {
      const options: BankWager[] = [
        { playerId: bot.id, action: "pot_shot", amount: 1 },
        { playerId: bot.id, action: "skip", amount: 0 },
        { playerId: bot.id, action: "chip_heist", amount: 1 },
      ];
      const choice = options[Math.floor(Math.random() * options.length)];
      if (bot.chips >= choice.amount) {
        this.state.bankWagers.push(choice);
      } else {
        this.state.bankWagers.push({
          playerId: bot.id,
          action: "skip",
          amount: 0,
        });
      }
      this.maybeAutoRollBank();
    }
  }
}

RushmoreBankServer satisfies Party.Worker;
