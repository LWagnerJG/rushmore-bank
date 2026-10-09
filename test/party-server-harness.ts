import type { Connection } from "partyserver";
import { QuarryServer } from "../party/server";

type StorageMap = Map<string, unknown>;

/** Minimal Durable Object state for unit tests (no workerd). */
export function createTestServer(
  roomId: string,
  options?: {
    connections?: Connection[];
    saved?: StorageMap;
    /** Shared deadline ref so restarts see the same alarm clock. */
    deadlineRef?: { current: number | null };
  },
) {
  const saved = options?.saved ?? new Map<string, unknown>();
  const deadlineRef = options?.deadlineRef ?? { current: null as number | null };
  const connections = options?.connections ?? [];

  const storage = {
    async get(key: string) {
      return structuredClone(saved.get(key));
    },
    async put(key: string, value: unknown) {
      saved.set(key, structuredClone(value));
    },
    async delete(key: string) {
      return saved.delete(key);
    },
    async getAlarm() {
      return deadlineRef.current;
    },
    async setAlarm(at: number) {
      deadlineRef.current = at;
    },
    async deleteAlarm() {
      deadlineRef.current = null;
    },
  };

  const ctx = {
    id: {
      name: roomId,
      toString() {
        return roomId;
      },
    },
    storage,
    getWebSockets() {
      return [];
    },
    acceptWebSocket() {},
    blockConcurrencyWhile<T>(fn: () => T | Promise<T>) {
      return fn();
    },
  };

  const env = {
    JUDGE_URL: "https://beans-game.vercel.app",
  };

  const server = new QuarryServer(
    ctx as unknown as DurableObjectState,
    env as never,
  );

  // Unit tests drive connections explicitly (no real WebSockets).
  server.getConnections = ((tag?: string) => {
    void tag;
    return connections;
  }) as typeof server.getConnections;

  return {
    server,
    saved,
    deadline: () => deadlineRef.current,
    deadlineRef,
    ctx,
    setDeadline(at: number | null) {
      deadlineRef.current = at;
    },
  };
}
