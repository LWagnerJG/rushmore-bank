import { describe, expect, it } from "vitest";
import { hostAiPreGameLine } from "../host-ai-pregame";

describe("hostAiPreGameLine", () => {
  it("stays quiet while the room has not projected health", () => {
    expect(hostAiPreGameLine(null)).toBeNull();
    expect(hostAiPreGameLine(undefined)).toBeNull();
  });

  it("shows on when the server says AI is configured and ready", () => {
    expect(
      hostAiPreGameLine({
        status: "ready",
        available: true,
        model: "gemini-3.5-flash-lite",
      }),
    ).toBe("AI judge on · gemini-3.5-flash-lite");
  });

  it("shows on without model when ready and available", () => {
    expect(
      hostAiPreGameLine({ status: "ready", available: true, model: null }),
    ).toBe("AI judge on");
  });

  it("shows muted off when the room is not configured for AI", () => {
    expect(
      hostAiPreGameLine({ status: "ready", available: false, model: null }),
    ).toBe("AI judge off, scores will be neutral");
  });

  it("shows off after a fallback round even if previously configured", () => {
    expect(
      hostAiPreGameLine({
        status: "fallback",
        available: true,
        fallbackReason: "invalid_output",
      }),
    ).toBe("AI judge off, scores will be neutral");
  });

  it("never embeds fallbackReason", () => {
    const line = hostAiPreGameLine({
      status: "fallback",
      available: true,
      fallbackReason: "timeout",
    });
    expect(line).not.toMatch(/timeout|no_key|fallback/i);
  });
});
