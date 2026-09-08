import { describe, expect, it } from "vitest";
import {
  TOPIC_COUNT,
  TOPICS,
  normalizeTopicText,
  pickRandomTopics,
} from "../topics";
import { emptyRoomState } from "../types";
import { projectPublicState } from "../engine/public-state";

describe("topic bank", () => {
  it("ships a huge curated pool (~1000)", () => {
    expect(TOPIC_COUNT).toBeGreaterThanOrEqual(800);
    expect(TOPIC_COUNT).toBe(TOPICS.length);
  });

  it("has unique ids and texts with no near-dupes", () => {
    const ids = new Set<string>();
    const texts = new Set<string>();
    const norms = new Set<string>();
    for (const t of TOPICS) {
      expect(t.id.length).toBeGreaterThan(2);
      expect(t.text.length).toBeGreaterThan(8);
      expect(t.scopeBoundary.length).toBeGreaterThan(8);
      expect(["sports", "food", "everyday", "entertainment"]).toContain(
        t.scope,
      );
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      const key = t.text.toLowerCase();
      expect(texts.has(key)).toBe(false);
      texts.add(key);
      const norm = normalizeTopicText(t.text);
      expect(norms.has(norm)).toBe(false);
      norms.add(norm);
    }
  });

  it("covers all four scopes with real depth", () => {
    const counts = {
      sports: 0,
      food: 0,
      everyday: 0,
      entertainment: 0,
    };
    for (const t of TOPICS) counts[t.scope]++;
    expect(counts.sports).toBeGreaterThanOrEqual(150);
    expect(counts.food).toBeGreaterThanOrEqual(150);
    expect(counts.everyday).toBeGreaterThanOrEqual(250);
    expect(counts.entertainment).toBeGreaterThanOrEqual(250);
  });
});

describe("pickRandomTopics anti-repeat", () => {
  it("never returns excluded ids while pool remains", () => {
    const first = pickRandomTopics(4, [], () => 0.42);
    expect(first).toHaveLength(4);
    const exclude = first.map((t) => t.id);
    const second = pickRandomTopics(4, exclude, () => 0.17);
    expect(second).toHaveLength(4);
    for (const t of second) {
      expect(exclude).not.toContain(t.id);
    }
  });

  it("falls back when soft excludes exhaust the bank", () => {
    const hard = TOPICS.slice(0, 3).map((t) => t.id);
    const soft = TOPICS.map((t) => t.id);
    const picked = pickRandomTopics(4, soft, Math.random, hard);
    expect(picked).toHaveLength(4);
    for (const t of picked) {
      expect(hard).not.toContain(t.id);
    }
  });

  it("reroll-style depletion yields unique shortlists until nearly empty", () => {
    const seen: string[] = [];
    const used: string[] = [];
    const shortlists: string[][] = [];
    for (let i = 0; i < 30; i++) {
      const soft = [...new Set([...used, ...seen])];
      let pool = pickRandomTopics(4, soft);
      if (pool.length < 4) {
        seen.length = 0;
        seen.push(...used);
        pool = pickRandomTopics(4, used);
      }
      expect(pool).toHaveLength(4);
      const ids = pool.map((t) => t.id);
      shortlists.push(ids);
      for (const id of ids) {
        if (!seen.includes(id)) seen.push(id);
      }
    }
    const flat = shortlists.flat();
    // First ~ (TOPIC_COUNT/4) rounds should be nearly all unique ids
    expect(new Set(flat).size).toBe(flat.length);
  });
});

describe("public topic projection", () => {
  it("exposes seenTopicCount without leaking seenTopicIds", () => {
    const state = emptyRoomState("ABCD");
    state.seenTopicIds = ["a", "b", "c"];
    const pub = projectPublicState(state, "p1");
    expect(pub.seenTopicCount).toBe(3);
    expect(
      Object.prototype.hasOwnProperty.call(pub, "seenTopicIds"),
    ).toBe(false);
  });
});
