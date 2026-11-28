/**
 * Scenario tests often assume a fixed roller (usually seat 0 = "A").
 * Production `beginDice` crypto-shuffles seatOrder; pin afterward so those
 * tests stay deterministic. Fairness of the shuffle is covered by rng tests.
 */
import type { QuarryServer } from "../party/server";

export function pinSeatOrder(server: QuarryServer, order: string[]) {
  server.state.seatOrder = [...order];
  server.state.players = server.state.players.map((p) => {
    if (p.role !== "player") return { ...p, seat: null };
    const idx = order.indexOf(p.id);
    return { ...p, seat: idx >= 0 ? idx : null };
  });
  server.state.diceTurnSeat = 0;
}
