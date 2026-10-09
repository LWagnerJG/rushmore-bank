import { describe, expect, it } from "vitest";
import {
  FINAL_ROUND_CUE_MS,
  isFinalTopicRound,
  shouldFireFinalRoundCue,
} from "../final-round-cue";

describe("final round cue", () => {
  it("keeps the beat short for phones", () => {
    expect(FINAL_ROUND_CUE_MS).toBeGreaterThanOrEqual(1000);
    expect(FINAL_ROUND_CUE_MS).toBeLessThanOrEqual(2200);
  });

  it("marks only the last topic round index", () => {
    expect(
      isFinalTopicRound({ topicRound: 2, configuredTopicRounds: 3 }),
    ).toBe(true);
    expect(
      isFinalTopicRound({ topicRound: 5, configuredTopicRounds: 6 }),
    ).toBe(true);
    expect(
      isFinalTopicRound({ topicRound: 0, configuredTopicRounds: 3 }),
    ).toBe(false);
    expect(
      isFinalTopicRound({ topicRound: 1, configuredTopicRounds: 3 }),
    ).toBe(false);
    expect(
      isFinalTopicRound({ topicRound: 0, configuredTopicRounds: 1 }),
    ).toBe(false);
  });

  it("fires when entering TOPIC_SELECTION for the final round", () => {
    expect(
      shouldFireFinalRoundCue({
        phase: "TOPIC_SELECTION",
        topicRound: 2,
        configuredTopicRounds: 3,
        prevPhase: "ROUND_RESULTS",
      }),
    ).toBe(true);
  });

  it("does not refire while already on TOPIC_SELECTION", () => {
    expect(
      shouldFireFinalRoundCue({
        phase: "TOPIC_SELECTION",
        topicRound: 2,
        configuredTopicRounds: 3,
        prevPhase: "TOPIC_SELECTION",
      }),
    ).toBe(false);
  });

  it("fires once on reconnect already parked on final topic", () => {
    expect(
      shouldFireFinalRoundCue({
        phase: "TOPIC_SELECTION",
        topicRound: 5,
        configuredTopicRounds: 6,
        prevPhase: null,
      }),
    ).toBe(true);
  });

  it("stays quiet on draft / earlier rounds", () => {
    expect(
      shouldFireFinalRoundCue({
        phase: "DRAFT",
        topicRound: 2,
        configuredTopicRounds: 3,
        prevPhase: "TOPIC_SELECTION",
      }),
    ).toBe(false);
    expect(
      shouldFireFinalRoundCue({
        phase: "TOPIC_SELECTION",
        topicRound: 0,
        configuredTopicRounds: 3,
        prevPhase: "LOBBY",
      }),
    ).toBe(false);
  });
});
