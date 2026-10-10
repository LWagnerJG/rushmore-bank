import { describe, expect, it } from "vitest";
import { hostAiPreGameLine } from "../host-ai-pregame";

describe("hostAiPreGameLine", () => {
  it("stays quiet while probing", () => {
    expect(hostAiPreGameLine(null)).toBeNull();
    expect(hostAiPreGameLine(undefined)).toBeNull();
  });

  it("shows model when AI is available", () => {
    expect(
      hostAiPreGameLine({
        available: true,
        model: "gemini-3.5-flash-lite",
      }),
    ).toBe("AI judge on · gemini-3.5-flash-lite");
  });

  it("shows on without model when probe has no id", () => {
    expect(hostAiPreGameLine({ available: true, model: null })).toBe(
      "AI judge on",
    );
  });

  it("shows muted off copy when unavailable", () => {
    expect(hostAiPreGameLine({ available: false, model: null })).toBe(
      "AI judge off, scores will be neutral",
    );
  });

  it("never embeds fallbackReason", () => {
    const line = hostAiPreGameLine({
      available: false,
      model: null,
    });
    expect(line).not.toMatch(/timeout|no_key|fallback/i);
  });
});
