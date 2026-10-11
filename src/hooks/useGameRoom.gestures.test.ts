import { describe, expect, it } from "vitest";
import { gestureKeyFor } from "./useGameRoom";

describe("gestureKeyFor stable actionId keys", () => {
  it("reuses the same key for double-tap start", () => {
    const a = gestureKeyFor({ type: "start" }, 3);
    const b = gestureKeyFor({ type: "start" }, 3);
    expect(a).toBe(b);
    expect(gestureKeyFor({ type: "start" }, 4)).not.toBe(a);
  });

  it("changes key when vote target changes", () => {
    expect(
      gestureKeyFor({ type: "submit_vote", targetPlayerId: "A" }, 1),
    ).not.toBe(
      gestureKeyFor({ type: "submit_vote", targetPlayerId: "B" }, 1),
    );
  });

  it("keys roll by phase revision only", () => {
    expect(gestureKeyFor({ type: "roll" }, 5)).toBe("roll:5");
  });

  it("gives each host round chip its own actionId (reselect must land)", () => {
    const four = gestureKeyFor({ type: "set_topic_rounds", rounds: 4 }, 1);
    const five = gestureKeyFor({ type: "set_topic_rounds", rounds: 5 }, 1);
    expect(four).toBe("set_topic_rounds:1:4");
    expect(five).toBe("set_topic_rounds:1:5");
    expect(four).not.toBe(five);
    expect(gestureKeyFor({ type: "set_topic_rounds", rounds: 4 }, 1)).toBe(four);
  });

  it("gives each topic vibe chip its own actionId", () => {
    const sports = gestureKeyFor(
      { type: "update_settings", settings: { topicVibe: "sports" } },
      2,
    );
    const basic = gestureKeyFor(
      { type: "update_settings", settings: { topicVibe: "basic" } },
      2,
    );
    expect(sports).not.toBe(basic);
    expect(sports).toBe("update_settings:2:sports:");
    expect(
      gestureKeyFor(
        { type: "update_settings", settings: { topicVibe: "sports" } },
        2,
      ),
    ).toBe(sports);
  });
});
