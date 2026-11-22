import { describe, expect, it } from "vitest";
import { hostAiCue } from "../host-ai-cue";

describe("hostAiCue", () => {
  it("treats missing health as unknown, never on", () => {
    expect(hostAiCue(undefined).label).toBe("AI unknown");
    expect(hostAiCue(null).label).toBe("AI unknown");
  });

  it("maps effective server statuses", () => {
    expect(hostAiCue({ status: "ready", available: true }).label).toBe("AI on");
    expect(hostAiCue({ status: "pending", available: true }).label).toBe(
      "Judging…",
    );
    expect(hostAiCue({ status: "ok", available: true }).label).toBe("AI on");
    expect(hostAiCue({ status: "fallback", available: true }).label).toBe(
      "AI off",
    );
    expect(hostAiCue({ status: "fallback", available: true }).detail).toMatch(
      /neutral awards/,
    );
  });

  it("forces off when the room is not configured for AI", () => {
    expect(hostAiCue({ status: "ready", available: false }).label).toBe(
      "AI off",
    );
    expect(hostAiCue({ status: "ok", available: false }).label).toBe("AI off");
  });

  it("includes model and latency in ok detail", () => {
    expect(
      hostAiCue({
        status: "ok",
        available: true,
        model: "gemini-3.5-flash-lite",
        latencyMs: 1200,
      }).detail,
    ).toMatch(/gemini-3.5-flash-lite/);
    expect(
      hostAiCue({
        status: "fallback",
        available: true,
        fallbackReason: "timeout",
        latencyMs: 900,
      }).detail,
    ).toMatch(/timeout/);
  });
});
