/**
 * Ambient types so the Next.js `tsc --noEmit` pass can resolve
 * `partyserver`'s `cloudflare:workers` import and Worker globals used by
 * `party/server.ts`. Runtime Workers use the real module; Vitest aliases
 * `cloudflare:workers` to `test/mocks/cloudflare-workers.ts`.
 */
declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    readonly ctx: DurableObjectState;
    readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
  export const env: Record<string, unknown>;
}

interface DurableObjectNamespace<T = unknown> {
  get(id: DurableObjectId): DurableObjectStub;
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  newUniqueId(): DurableObjectId;
}

interface DurableObjectId {
  readonly name?: string;
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectState {
  readonly id: DurableObjectId;
  readonly storage: DurableObjectStorage;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  blockConcurrencyWhile<T>(fn: () => T | Promise<T>): Promise<T>;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  getAlarm(): Promise<number | null>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm(): Promise<void>;
}

interface ExportedHandler<Env = unknown> {
  fetch?(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response>;
  scheduled?(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): void | Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  readonly scheduledTime: number;
  readonly cron: string;
}
