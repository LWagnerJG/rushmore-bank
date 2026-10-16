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

  it("gives each avatar tap its own actionId (reselect after no-op must land)", () => {
    const aviator = gestureKeyFor(
      { type: "set_avatar", avatarId: "aviator" },
      1,
    );
    const grill = gestureKeyFor({ type: "set_avatar", avatarId: "grill" }, 1);
    expect(aviator).toBe("set_avatar:1:aviator");
    expect(grill).toBe("set_avatar:1:grill");
    expect(aviator).not.toBe(grill);
    expect(
      gestureKeyFor({ type: "set_avatar", avatarId: "aviator" }, 1),
    ).toBe(aviator);
  });

  it("gives each remove_player target its own actionId", () => {
    const a = gestureKeyFor({ type: "remove_player", playerId: "p1" }, 2);
    const b = gestureKeyFor({ type: "remove_player", playerId: "p2" }, 2);
    expect(a).toBe("remove_player:2:p1");
    expect(b).toBe("remove_player:2:p2");
    expect(a).not.toBe(b);
  });

  it("gives each host_correct target its own actionId", () => {
    const dup = gestureKeyFor(
      { type: "host_correct", turnIndex: 0, reason: "duplicate" },
      3,
    );
    const inv = gestureKeyFor(
      { type: "host_correct", turnIndex: 1, reason: "invalid" },
      3,
    );
    expect(dup).toBe("host_correct:3:0:duplicate");
    expect(inv).toBe("host_correct:3:1:invalid");
    expect(dup).not.toBe(inv);
  });

  it("gives each custom_topic text its own actionId", () => {
    const a = gestureKeyFor(
      {
        type: "custom_topic",
        text: "Best films",
        scope: "entertainment",
        scopeBoundary: "movies",
      },
      1,
    );
    const b = gestureKeyFor(
      {
        type: "custom_topic",
        text: "Worst films",
        scope: "entertainment",
        scopeBoundary: "movies",
      },
      1,
    );
    expect(a).not.toBe(b);
    expect(a).toContain("Best films");
  });

  it("gives each rename its own actionId", () => {
    const a = gestureKeyFor({ type: "rename", name: "Ada" }, 1);
    const b = gestureKeyFor({ type: "rename", name: "Bea" }, 1);
    expect(a).toBe("rename:1:Ada");
    expect(b).toBe("rename:1:Bea");
    expect(a).not.toBe(b);
  });
});
