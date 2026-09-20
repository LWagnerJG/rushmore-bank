import { describe, expect, it } from "vitest";
import { hostAiCue } from "../host-ai-cue";

describe("host AI status copy", () => {
  it("does not claim readiness when the server sends no status", () => {
    expect(hostAiCue(undefined).label).toBe("AI unknown");
    expect(hostAiCue(null).label).toBe("AI unknown");
  });

  it("distinguishes untested, pending, successful, and fallback judging", () => {
    expect(hostAiCue("ready").label).toBe("AI waiting");
    expect(hostAiCue("pending").label).toBe("Judging…");
    expect(hostAiCue("ok").label).toBe("AI ok");
    expect(hostAiCue("fallback").label).toBe("AI off");
    expect(hostAiCue("fallback").detail).toMatch(/neutral awards/);
  });
});
