/**
 * Minimal stub so `partyserver` (which imports `cloudflare:workers`) can load
 * under Vitest/Node. Production runs use the real Workers runtime.
 */
export class DurableObject {
  readonly ctx: unknown;
  readonly env: unknown;
  constructor(ctx: unknown, env: unknown) {
    this.ctx = ctx;
    this.env = env;
  }
}

/** PartyServer imports this; unused in unit tests. */
export const env = {};
