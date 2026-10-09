import { describe, expect, it } from "vitest";
import { hostAiCue } from "../host-ai-cue";

describe("host AI status copy", () => {
  it("does not claim readiness when the server sends no status", () => {
    expect(hostAiCue(undefined).label).toBe("AI unknown");
    expect(hostAiCue(null).label).toBe("AI unknown");
  });

  it("distinguishes untested, pending, successful, and fallback judging", () => {
    expect(hostAiCue({ status: "ready" }).label).toBe("AI waiting");
    expect(hostAiCue({ status: "pending" }).label).toBe("Judging…");
    expect(hostAiCue({ status: "ok" }).label).toBe("AI ok");
    expect(hostAiCue({ status: "fallback" }).label).toBe("AI off");
    expect(hostAiCue({ status: "fallback" }).detail).toMatch(/neutral awards/);
  });

  it("surfaces fallbackReason / model / latency only in host detail", () => {
    expect(
      hostAiCue({
        status: "fallback",
        fallbackReason: "timeout",
        latencyMs: 14012,
      }).detail,
    ).toMatch(/timeout/);
    expect(
      hostAiCue({
        status: "ok",
        model: "gemini-3.5-flash-lite",
        latencyMs: 2100,
      }).detail,
    ).toMatch(/gemini-3\.5-flash-lite/);
    expect(
      hostAiCue({
        status: "ok",
        model: "gemini-3.5-flash-lite",
        latencyMs: 2100,
      }).detail,
    ).toMatch(/2100ms/);
  });
});
