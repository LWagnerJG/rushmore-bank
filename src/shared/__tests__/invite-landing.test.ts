import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "@/hooks/useHydrated";
import { contrastRatio, rootToken, rulesFor } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");
const room = read("components/RoomClient.tsx");
const hook = read("hooks/useGameRoom.ts");
const home = read("app/page.tsx");
const css = read("app/globals.css");
const joinScreens = room.slice(
  room.indexOf("if (!joined || !you) {"),
  room.indexOf("// Lock the shell; scroll lives in .room-phase-scroll"),
);
const nameForm = joinScreens.slice(joinScreens.indexOf("{hydrated ? ("));

describe("invite landing renders client-only parts after hydration", () => {
  it("useHydrated is false in the server render", () => {
    const Probe = () => createElement("i", null, String(useHydrated()));
    expect(renderToString(createElement(Probe))).toBe("<i>false</i>");
  });

  it("the stored-name form, errors, and links wait for hydration", () => {
    expect(room).toMatch(/const hydrated = useHydrated\(\);/);
    expect(nameForm).toMatch(/^\{hydrated \? \(\s*<>\s*<input/);
    expect(nameForm).toMatch(/\{homeLink\}\s*<\/>\s*\) : null\}/);
  });

  it("keeps focus and Enter behavior: autoFocus input, Enter joins", () => {
    expect(nameForm.match(/autoFocus/g)).toHaveLength(1);
    expect(nameForm).toMatch(/if \(e\.key === "Enter"\) joinGame\(\);/);
    expect(nameForm).toMatch(/onClick=\{joinGame\}/);
  });
});

describe("rejoin only for a real seat", () => {
  it("no blanket Rejoin button from the last-used id", () => {
    expect(room).not.toMatch(/getLastPlayerIdForRejoin|Rejoin this room/);
  });

  it("prefills this phone's seat name and takes that seat back on Join", () => {
    expect(room).toMatch(/presetName \|\| rejoinOffer\(code\)\?\.name \|\| defaultName/);
    expect(room).toMatch(
      /const prior = preferSpectate \? null : rejoinOffer\(code\);[\s\S]*?clean\.toLowerCase\(\) === prior\.name\.trim\(\)\.toLowerCase\(\)[\s\S]*?adoptPlayerIdForRejoin\(code, prior\.playerId\)/,
    );
  });

  it("Home remembers a typed name, never the admin fallback", () => {
    const confirm = home.slice(
      home.indexOf("function confirmName"),
      home.indexOf("function editName"),
    );
    expect(confirm).toMatch(
      /if \(!name\.trim\(\) && adminUnlocked\) \{\s*setName\(ADMIN_DISPLAY_NAME\);\s*\} else \{[\s\S]*?rememberDisplayName\(clean\);/,
    );
  });
});

describe("one primary, honest copy", () => {
  it("Join game is the only primary; Watch only is a quiet text button", () => {
    expect(nameForm.match(/btn-primary/g)).toHaveLength(1);
    expect(nameForm).toMatch(/className="btn-quiet self-center"[\s\S]*?Watch only/);
    expect(nameForm).not.toMatch(/btn-secondary/);
  });

  it("plain copy, said once", () => {
    expect(joinScreens).toMatch(/"Pick a name to join\."/);
    expect(room).not.toMatch(/Connected — enter a nickname/);
    // "Connecting…" in the status line is enough; no second Reconnecting line.
    expect(joinScreens).not.toMatch(/>\s*Reconnecting…\s*</);
    expect(joinScreens).toMatch(/const joinError = error === "Reconnecting…" \? null : error;/);
  });

  it("removal is explained once, by the status line", () => {
    expect(joinScreens).toMatch(/"The host removed this seat\. You can join again below\."/);
    expect(hook).toMatch(
      /markRoomRemoved\(code, playerId\);[\s\S]{0,120}?setErrorRaw\(null\);\s*return;/,
    );
    expect(hook).not.toMatch(/or Rejoin/);
  });
});

describe("readable, tappable", () => {
  it("errors and Home use coral ink at 4.5:1 on cream", () => {
    expect(joinScreens).not.toMatch(/var\(--coral\)\]/);
    expect(joinScreens.match(/text-\[var\(--coral-ink\)\]/g)?.length).toBe(3);
    expect(
      contrastRatio(rootToken(css, "coral-ink"), rootToken(css, "bg")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("the quiet button is ink on cream, 44px, and presses with opacity only", () => {
    const [quiet] = rulesFor(css, ".btn-quiet");
    expect(quiet).toMatch(/color:\s*var\(--text\)/);
    expect(quiet).toMatch(/min-height:\s*var\(--tap-min\)/);
    expect(
      contrastRatio(rootToken(css, "text"), rootToken(css, "bg")),
    ).toBeGreaterThanOrEqual(4.5);
    for (const body of rulesFor(css, ".btn-quiet")) {
      expect(body).not.toMatch(/animation|filter|box-shadow/);
    }
  });

  it("Home link is a 44px target", () => {
    expect(joinScreens).toMatch(
      /href="\/"\s*className="inline-flex min-h-\[var\(--tap-min\)\] items-center/,
    );
  });
});
