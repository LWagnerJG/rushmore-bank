/**
 * Shared PartySocket helpers for programmatic smokes against PartyServer.
 */
import PartySocket from "partysocket";

export const DEFAULT_PARTY_HOST = "beans-party.beans-lwagner.workers.dev";
/** Optional worker ADMIN_PIN; host-only admin works when unset (local wrangler). */
export const ADMIN_PIN = process.env.ADMIN_PIN || "";

export function resolvePartyHost(): string {
  return (
    process.env.PARTY_HOST ||
    process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
    process.env.PARTYKIT_HOST ||
    DEFAULT_PARTY_HOST
  );
}

export function randomRoomCode(prefix = "SM"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 6)}`.toUpperCase().slice(0, 8);
}

export type PublicState = {
  phase: string;
  phaseRevision: number;
  players: { id: string; name: string; stones: number; isHost?: boolean; role?: string }[];
  picks: { playerId: string; text: string; turnIndex?: number }[];
  topicOptions?: { id: string; text: string }[];
  topicVoteCounts?: Record<string, number>;
  selectedTopic: { id: string; text: string } | null;
  draftCursor: number;
  seatOrder: string[];
  draftOrder: number[];
  notice: string | null;
  scores?: unknown[];
  earnedThisRound?: Record<string, number>;
  wagers?: Record<string, number>;
  diceSubphase?: string;
  diceTurnSeat?: number;
  diceActiveIds?: string[];
  pots?: Record<string, number>;
  personalRollCounts?: Record<string, number>;
  gameOver?: boolean;
  topicRound?: number;
  configuredTopicRounds?: number;
  myTopicVote?: string | null;
  myHumanVote?: string | null;
  myBankBeansReady?: boolean;
  bankBeansReadyIds?: string[];
  partyPrompt?: { kind: string; targetPlayerIds: string[] } | null;
};

export type ServerMsg = {
  type: string;
  state?: PublicState;
  youId?: string;
  message?: string;
};

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class SmokeClient {
  sock: PartySocket;
  state: PublicState | null = null;
  youId: string;
  lastError: string | null = null;
  readonly name: string;
  readonly id: string;
  private waiters: Array<() => void> = [];

  constructor(host: string, room: string, id: string, name: string) {
    this.id = id;
    this.name = name;
    this.youId = id;
    this.sock = new PartySocket({ host, room, id });
    this.sock.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as ServerMsg;
      if (msg.type === "error") {
        this.lastError = msg.message ?? "error";
        console.error(`[${this.name}] error:`, this.lastError);
        this.wake();
        return;
      }
      if (msg.type === "state" || msg.type === "joined") {
        if (msg.state) this.state = msg.state;
        if (msg.youId) this.youId = msg.youId;
        this.wake();
      }
    });
  }

  private wake() {
    for (const w of this.waiters.splice(0)) w();
  }

  send(m: object) {
    this.sock.send(
      JSON.stringify({
        ...m,
        actionId: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    );
  }

  async connect(timeoutMs = 10000) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`[${this.name}] connect timeout`)), timeoutMs);
      if (this.sock.readyState === WebSocket.OPEN) {
        clearTimeout(t);
        resolve();
        return;
      }
      this.sock.addEventListener("open", () => {
        clearTimeout(t);
        resolve();
      });
      this.sock.addEventListener("error", () => {
        clearTimeout(t);
        reject(new Error(`[${this.name}] socket error`));
      });
    });
  }

  /** Join and wait until this seat appears in the roster (not merely LOBBY). */
  async join(role: "player" | "spectator" = "player", timeoutMs = 10000) {
    this.send({ type: "join", name: this.name, role });
    await this.wait(
      () =>
        !!this.state?.players?.some(
          (p) => p.id === this.youId || p.name === this.name,
        ),
      timeoutMs,
      "join roster",
    );
  }

  async wait(
    pred: () => boolean,
    timeoutMs = 15000,
    label = "condition",
  ): Promise<PublicState> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.state && pred()) return this.state;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 250);
        this.waiters.push(() => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    throw new Error(
      `[${this.name}] timeout waiting for ${label} (phase=${this.state?.phase ?? "none"})`,
    );
  }

  async waitPhase(phase: string, timeoutMs = 15000) {
    return this.wait(() => this.state?.phase === phase, timeoutMs, `phase ${phase}`);
  }

  close() {
    this.sock.close();
  }

  draftTurnId(): string | null {
    const s = this.state;
    if (!s) return null;
    const seat = s.draftOrder[s.draftCursor];
    if (seat === undefined) return null;
    return s.seatOrder[seat] ?? null;
  }

  diceTurnId(): string | null {
    const s = this.state;
    if (!s || s.diceTurnSeat == null) return null;
    return s.seatOrder[s.diceTurnSeat] ?? null;
  }
}

/** Drive the human seat through whatever phase the room is in. */
export async function playHumanTurn(client: SmokeClient): Promise<void> {
  const s = client.state;
  if (!s) return;
  const me = client.youId;

  switch (s.phase) {
    case "TOPIC_SELECTION": {
      if (s.myTopicVote) return;
      const opts = s.topicOptions ?? [];
      const topicId = opts[0]?.id;
      if (!topicId) return;
      client.send({ type: "vote_topic", topicId });
      return;
    }
    case "DRAFT":
    case "CORRECTION": {
      if (client.draftTurnId() !== me) return;
      const pick = `Smoke-${client.name}-${s.draftCursor}`;
      client.send({ type: "lock_in", text: pick });
      return;
    }
    case "REVIEW": {
      client.send({ type: "skip_review" });
      return;
    }
    case "VOTING_AND_JUDGING": {
      if (s.myHumanVote) return;
      if (s.seatOrder.length === 2) return;
      const target = s.seatOrder.find((id) => id !== me);
      if (!target) return;
      client.send({ type: "submit_vote", targetPlayerId: target });
      return;
    }
    case "SCORE_REVEAL": {
      if (s.myBankBeansReady) return;
      client.send({ type: "bank_the_beans" });
      return;
    }
    case "WAGER_SELECTION": {
      if (s.wagers && s.wagers[me] !== undefined) return;
      const earned = s.earnedThisRound?.[me] ?? 0;
      const banked = s.players.find((p) => p.id === me)?.stones ?? 0;
      const max = Math.max(0, Math.floor(earned) + Math.floor(banked));
      const amount = max >= 1 ? Math.max(1, Math.min(max, Math.floor(earned / 2) || 1)) : 0;
      client.send({ type: "submit_wager", amount });
      return;
    }
    case "DICE": {
      if (s.diceSubphase !== "READY") return;
      if (client.diceTurnId() !== me) return;
      if (!(s.diceActiveIds ?? []).includes(me)) return;
      const rolls = s.personalRollCounts?.[me] ?? 0;
      // Keep it short for smoke: roll once, then bank.
      if (rolls === 0) client.send({ type: "roll" });
      else client.send({ type: "pull_out" });
      return;
    }
    case "ROUND_RESULTS": {
      // Host advances when multi-round; bots don't drive next_topic.
      const host = s.players.find((p) => p.isHost);
      if (host?.id === me && !s.gameOver) {
        client.send({ type: "next_topic" });
      }
      return;
    }
    default:
      return;
  }
}
