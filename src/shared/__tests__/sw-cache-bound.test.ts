import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sw = readFileSync(resolve(__dirname, "../../../public/sw.js"), "utf8");
const beanAvatar = readFileSync(
  resolve(__dirname, "../../components/BeanAvatar.tsx"),
  "utf8",
);
const profileBtn = readFileSync(
  resolve(__dirname, "../../components/ProfileButton.tsx"),
  "utf8",
);
const sfx = readFileSync(resolve(__dirname, "../../lib/sfx.ts"), "utf8");

describe("service worker cache bound", () => {
  it("bumps cache bucket and trims oldest entries", () => {
    expect(sw).toMatch(/beans-shell-v5/);
    expect(sw).toMatch(/MAX_CACHE_ENTRIES\s*=\s*80/);
    expect(sw).toMatch(/putBounded/);
    expect(sw).toMatch(/cache\.delete\(oldest\)/);
    expect(sw).toMatch(/status:\s*503/);
  });
});

describe("avatar decode / priority", () => {
  it("profile mark requests eager high-priority decode", () => {
    expect(profileBtn).toMatch(/BeanAvatar[^>]*priority/);
    expect(beanAvatar).toMatch(/fetchPriority/);
    expect(beanAvatar).toMatch(/decoding=\{priority \? "sync" : "async"\}/);
  });
});

describe("gesture unlock listener hygiene", () => {
  it("removes capture listeners after first unlock", () => {
    expect(sfx).toMatch(/removeEventListener\(type, unlock/);
  });
});
