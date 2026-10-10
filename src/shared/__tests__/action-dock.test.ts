import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LobbyPanel } from "@/components/LobbyPanel";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ScorePanel } from "@/components/ScorePanel";
import { WagerPanel } from "@/components/WagerPanel";
import { markRevealCompleted, resultsRevealKey } from "@/lib/results-reveal";
import { projectPublicState } from "@/shared/engine/public-state";
import type { Phase, Player, PublicRoomState, RoomState } from "@/shared/types";
import { emptyRoomState } from "@/shared/types";
import { contrastRatio, rootToken, rulesFor } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");
const css = read("app/globals.css");
const room = read("components/RoomClient.tsx");

type El = {
  tag: string;
  cls: string[];
  attrs: string;
  text: string;
  parent?: El;
  children: El[];
};

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr"]);

/** Element tree of React's static markup (enough to check dock placement). */
function parse(html: string): El {
  const root: El = { tag: "#root", cls: [], attrs: "", text: "", children: [] };
  let cur = root;
  for (const [tok] of html.matchAll(/<[^>]+>|[^<]+/g)) {
    if (!tok.startsWith("<")) {
      for (let n: El | undefined = cur; n; n = n.parent) n.text += tok;
    } else if (tok.startsWith("</")) {
      cur = cur.parent ?? root;
    } else {
      const m = /^<([a-zA-Z][\w-]*)([\s\S]*?)(\/?)>$/.exec(tok);
      if (!m) continue;
      const cls = /\bclass="([^"]*)"/.exec(m[2])?.[1] ?? "";
      const el: El = {
        tag: m[1],
        cls: cls.split(/\s+/).filter(Boolean),
        attrs: m[2],
        text: "",
        parent: cur,
        children: [],
      };
      cur.children.push(el);
      if (!m[3] && !VOID.has(m[1])) cur = el;
    }
  }
  return root;
}

function findAll(el: El, pred: (e: El) => boolean, out: El[] = []): El[] {
  for (const c of el.children) {
    if (pred(c)) out.push(c);
    findAll(c, pred, out);
  }
  return out;
}

const has = (cls: string) => (e: El) => e.cls.includes(cls);

function render<P extends object>(C: ComponentType<P>, props: P): El {
  return parse(renderToStaticMarkup(createElement(C, props)));
}

function only(el: El, cls: string): El {
  const found = findAll(el, has(cls));
  expect(found, cls).toHaveLength(1);
  return found[0]!;
}

function seat(id: string, name: string, extra: Partial<Player> = {}): Player {
  return {
    id,
    name,
    stones: 40,
    connected: true,
    isHost: id === "a",
    role: "player",
    seat: 0,
    joinedAt: 1,
    ...extra,
  };
}

function roomAt(phase: Phase, tweak: (s: RoomState) => void = () => {}) {
  const s = emptyRoomState("DOCK");
  s.phase = phase;
  s.players = [seat("a", "Ada"), seat("b", "Bea"), seat("c", "Cal")];
  s.seatOrder = ["a", "b", "c"];
  s.configuredTopicRounds = 3;
  s.topicRound = 1;
  tweak(s);
  return s;
}

function viewOf(s: RoomState, youId: string) {
  const state: PublicRoomState = projectPublicState(s, youId);
  const you = state.players.find((p) => p.id === youId)!;
  return { state, you, send: () => {} };
}

function revealed(s: RoomState) {
  markRevealCompleted(
    resultsRevealKey({
      code: s.code,
      createdAt: s.createdAt,
      phase: s.phase,
      topicRound: s.topicRound,
    }),
  );
  return s;
}

describe("score reveal dock", () => {
  it("puts Ready to wager in a dock that is the layout's last child", () => {
    const tree = render(ScorePanel, viewOf(roomAt("SCORE_REVEAL"), "b"));
    const layout = tree.children[0]!;
    expect(layout.cls).toEqual(["score-layout"]);
    const dock = layout.children.at(-1)!;
    expect(dock.cls).toEqual(["phase-sticky-cta", "score-dock"]);
    const buttons = findAll(dock, (e) => e.tag === "button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.cls).toContain("btn-primary");
    expect(buttons[0]!.cls).not.toContain("btn-done");
    expect(buttons[0]!.attrs).not.toMatch(/disabled/);
    expect(buttons[0]!.text).toBe("Ready to wager");
  });

  it("keeps one status line in the dock and drops the avatar roster", () => {
    const tree = render(ScorePanel, viewOf(roomAt("SCORE_REVEAL", (s) => {
      s.bankBeansReady = { a: true };
    }), "b"));
    const dock = only(tree, "phase-sticky-cta");
    const status = only(dock, "waiting-roster");
    expect(status.cls).toContain("waiting-roster-compact");
    expect(only(status, "waiting-roster-status").text).toBe("Waiting on you, Cal");
    expect(only(status, "waiting-roster-count").text).toBe("1/3");
    expect(findAll(tree, has("waiting-roster-avatars"))).toHaveLength(0);
    expect(tree.text).not.toMatch(/Ready to wager[\s\S]*Ready to wager/);
  });

  it("shows a calm done state once you are ready", () => {
    const tree = render(ScorePanel, viewOf(roomAt("SCORE_REVEAL", (s) => {
      s.bankBeansReady = { b: true };
    }), "b"));
    const button = findAll(only(tree, "phase-sticky-cta"), (e) => e.tag === "button")[0]!;
    expect(button.cls).toEqual(expect.arrayContaining(["btn-primary", "btn-done"]));
    expect(button.attrs).toMatch(/disabled/);
    expect(button.text).toBe("Ready ✓");
  });

  it("gives spectators the status line without a button", () => {
    const tree = render(ScorePanel, viewOf(roomAt("SCORE_REVEAL", (s) => {
      s.players.push(seat("w", "Wes", { role: "spectator" }));
    }), "w"));
    const dock = only(tree, "phase-sticky-cta");
    expect(findAll(dock, has("waiting-roster-status"))).toHaveLength(1);
    expect(findAll(dock, (e) => e.tag === "button")).toHaveLength(0);
  });

  it("keeps Force wager in the content, not in the dock", () => {
    const tree = render(ScorePanel, viewOf(roomAt("SCORE_REVEAL"), "a"));
    const force = findAll(tree, (e) => e.tag === "button" && e.text === "Force wager (host)");
    expect(force).toHaveLength(1);
    expect(force[0]!.parent!.cls).toContain("roster-board");
  });

  it("drops the pulsing pill above the cards", () => {
    expect(room).not.toMatch(/ready-wager|pulse-soft|bank_the_beans/);
    expect(css).not.toMatch(/ready-wager|pulse-soft/);
  });
});

describe("results docks", () => {
  it("round results: Next topic docks; End game follows in the flow", () => {
    const s = revealed(roomAt("ROUND_RESULTS"));
    const tree = render(ResultsPanel, viewOf(s, "a"));
    const panel = tree.children[0]!;
    expect(panel.cls).toContain("endgame-panel");
    const docks = panel.children.filter(has("phase-sticky-cta"));
    expect(docks).toHaveLength(1);
    expect(docks[0]!.text).toBe("Next topic");
    const after = panel.children[panel.children.indexOf(docks[0]!) + 1]!;
    expect(after.cls).toEqual(
      expect.arrayContaining(["btn-secondary", "dock-trailing"]),
    );
    expect(after.text).toBe("End game");
  });

  it("final-round results: See final standings is the panel's last child", () => {
    const s = revealed(roomAt("ROUND_RESULTS", (r) => (r.topicRound = 3)));
    const tree = render(ResultsPanel, viewOf(s, "a"));
    const panel = tree.children[0]!;
    const dock = panel.children.at(-1)!;
    expect(dock.cls).toEqual(["phase-sticky-cta"]);
    expect(dock.text).toBe("See final standings");
    expect(tree.text).not.toMatch(/End game/);
  });

  it("players without host controls get no dock on round results", () => {
    const tree = render(ResultsPanel, viewOf(revealed(roomAt("ROUND_RESULTS")), "b"));
    expect(findAll(tree, has("phase-sticky-cta"))).toHaveLength(0);
  });

  it("final standings: ready count + Rematch dock, Home follows", () => {
    const s = revealed(roomAt("GAME_RESULTS", (r) => {
      r.gameOver = true;
      r.rematchReady = { a: true };
    }));
    const tree = render(ResultsPanel, viewOf(s, "b"));
    const panel = tree.children[0]!;
    const dock = panel.children.find(has("phase-sticky-cta"))!;
    expect(dock.parent).toBe(panel);
    expect(dock.children.map((c) => c.text)).toEqual(["1/3 ready", "Rematch"]);
    const after = panel.children[panel.children.indexOf(dock) + 1]!;
    expect(after.tag).toBe("a");
    expect(after.cls).toEqual(expect.arrayContaining(["endgame-home", "dock-trailing"]));
  });

  it("final standings: your Ready uses the done state", () => {
    const s = revealed(roomAt("GAME_RESULTS", (r) => {
      r.gameOver = true;
      r.rematchReady = { b: true };
    }));
    const rematch = only(render(ResultsPanel, viewOf(s, "b")), "endgame-rematch-btn");
    expect(rematch.cls).toContain("btn-done");
    expect(rematch.attrs).toMatch(/disabled/);
    expect(rematch.text).toBe("Ready ✓");
  });
});

describe("docks can travel the whole screen", () => {
  it("lobby Start is a direct, last child of the full-height lobby layout", () => {
    const tree = render(LobbyPanel, viewOf(roomAt("LOBBY"), "a"));
    const layout = tree.children[0]!;
    expect(layout.cls).toContain("lobby-layout");
    const dock = layout.children.at(-1)!;
    expect(dock.cls).toEqual(["lobby-start-slot", "phase-sticky-cta"]);
    expect(findAll(tree, has("phase-sticky-cta"))).toEqual([dock]);
  });

  it("wager lock stays a direct child of the wager flow", () => {
    const tree = render(WagerPanel, {
      ...viewOf(roomAt("WAGER_SELECTION", (s) => {
        s.earnedThisRound = { b: 30 };
      }), "b"),
      youId: "b",
    });
    const flow = tree.children[0]!;
    expect(flow.cls).toContain("wager-flow");
    expect(flow.children.at(-1)!.cls).toEqual(["phase-sticky-cta"]);
  });

  it("the phase body fills the scrollport so short screens dock at the bottom", () => {
    expect(room).toMatch(
      /connected \? "room-phase-fill" : "room-phase-fill reconnect-dimmed"/,
    );
    const fill = rulesFor(css, ".room-phase-fill").join("\n");
    expect(fill).toMatch(/display:\s*flex/);
    expect(fill).toMatch(/flex-direction:\s*column/);
    expect(fill).toMatch(/min-height:\s*100%/);
    expect(fill).toMatch(/flex:\s*1 0 auto/);
    for (const layout of [".lobby-layout", ".score-layout", ".endgame-panel"]) {
      const body = css.match(new RegExp(`\\n${layout.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(body, layout).toMatch(/flex:\s*1 0 auto/);
    }
    expect(css).not.toMatch(/\.lobby-host-tools/);
  });

  it("a resting dock sits exactly where a stuck one does", () => {
    expect(rootToken(css, "phase-pad-b")).toBe(
      "max(0.75rem, env(safe-area-inset-bottom, 0px))",
    );
    expect(room.match(/phase-panel flex min-h-full flex-col pb-\[var\(--phase-pad-b\)\]/g)).toHaveLength(2);
    expect(css).toMatch(
      /\.phase-sticky-cta:last-child\s*\{\s*margin-bottom:\s*calc\(-1 \* var\(--phase-pad-b\)\);/,
    );
    // The dock's own safe-area padding is never zeroed (Start sat under the home bar).
    for (const body of rulesFor(css, ".lobby-start-slot")) {
      expect(body).not.toMatch(/padding-bottom/);
    }
  });
});

describe("done button", () => {
  it("is mint with ink text at full opacity, AA in both palettes", () => {
    const body = rulesFor(css, ".btn-done").join("\n");
    expect(css).toMatch(/\.btn-primary\.btn-done,\s*\n\.btn-primary\.btn-done:disabled\s*\{/);
    expect(body).toMatch(/background:\s*var\(--mint\)/);
    expect(body).toMatch(/color:\s*var\(--text\)/);
    expect(body).toMatch(/opacity:\s*1/);
    const ink = rootToken(css, "text");
    expect(contrastRatio(ink, rootToken(css, "mint"))).toBeGreaterThanOrEqual(4.5);
    const party = css.match(/html\.party-on\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const partyMint = party.match(/--mint:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
    expect(contrastRatio(ink, partyMint)).toBeGreaterThanOrEqual(4.5);
  });
});
