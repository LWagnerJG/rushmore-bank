/**
 * Client/server sync: monotonic state versions, gap detection, ping RTT.
 *
 * Playtest lag: broadcasts had phaseRevision (game beats only) and no
 * per-message sequence. A dropped WS frame left one phone on stale state
 * with no way to notice. Messages sent while the socket was CONNECTING
 * were discarded. iOS could keep readyState OPEN on a dead socket.
 */
export const SYNC_PING_MS = 2_000;
export const SYNC_DEAD_SOCKET_MS = 5_000;
/** Flush queued client actions once the socket is OPEN. */
export const SYNC_CONNECTING_QUEUE_MAX = 32;

export type SyncGapKind = "ok" | "first" | "stale" | "gap";

/** Compare a newly arrived version to the last applied one. */
export function classifyStateVersion(
  lastApplied: number | null,
  incoming: number | null | undefined,
  opts?: { allowEqual?: boolean; allowRegression?: boolean },
): SyncGapKind {
  if (incoming == null || !Number.isFinite(incoming)) return "ok";
  if (lastApplied == null) return "first";
  if (incoming < lastApplied) return opts?.allowRegression ? "ok" : "stale";
  if (incoming === lastApplied) return opts?.allowEqual ? "ok" : "stale";
  if (incoming > lastApplied + 1) return "gap";
  return "ok";
}

export function shouldRequestResync(kind: SyncGapKind): boolean {
  return kind === "gap";
}

export function shouldApplyState(kind: SyncGapKind): boolean {
  // Apply first / ok / gap (newer wins). Ignore stale replays.
  return kind !== "stale";
}

export function nextAppliedVersion(
  lastApplied: number | null,
  incoming: number | null | undefined,
): number | null {
  const kind = classifyStateVersion(lastApplied, incoming);
  if (!shouldApplyState(kind) || incoming == null) return lastApplied;
  return incoming;
}

export type PingMessage = { type: "ping"; t: number };
export type PongMessage = { type: "pong"; t: number; serverT: number };
export type ResyncMessage = { type: "resync"; lastVersion?: number };

export function makePing(now = Date.now()): PingMessage {
  return { type: "ping", t: now };
}

export function makePong(t: number, serverT = Date.now()): PongMessage {
  return { type: "pong", t, serverT };
}

export function pingRttMs(pong: Pick<PongMessage, "t">, now = Date.now()): number {
  return Math.max(0, now - pong.t);
}

export function socketLooksDead(
  lastPongAt: number | null,
  now = Date.now(),
  deadMs = SYNC_DEAD_SOCKET_MS,
): boolean {
  if (lastPongAt == null) return now >= deadMs;
  return now - lastPongAt >= deadMs;
}

/** Enqueue an outbound payload; drop the oldest when the socket is wedged. */
export function enqueueWhileConnecting<T>(
  queue: T[],
  item: T,
  max = SYNC_CONNECTING_QUEUE_MAX,
): T[] {
  const next = queue.length >= max ? queue.slice(queue.length - max + 1) : queue.slice();
  next.push(item);
  return next;
}

/**
 * Send queued actions in order. If one throw, keep that item and the
 * unsent tail so a half-open socket cannot drop later gestures.
 */
export function flushQueuedSends<T>(
  queued: readonly T[],
  send: (item: T) => void,
): T[] {
  for (let i = 0; i < queued.length; i++) {
    try {
      send(queued[i] as T);
    } catch {
      return queued.slice(i);
    }
  }
  return [];
}

export function versionFromMessage(msg: {
  seq?: number;
  state?: { stateVersion?: number; phaseRevision?: number };
}): number | null {
  if (typeof msg.seq === "number" && Number.isFinite(msg.seq)) return msg.seq;
  const v = msg.state?.stateVersion;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
