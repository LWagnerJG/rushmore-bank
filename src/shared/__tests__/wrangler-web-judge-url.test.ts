import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = readFileSync(
  resolve(__dirname, "../../../wrangler.web.jsonc"),
  "utf8",
);

describe("beans-web JUDGE_URL for pre-game probe", () => {
  it("points GET /api/judge upstream at the Vercel judge host", () => {
    expect(config).toMatch(/"JUDGE_URL"\s*:\s*"https:\/\/beans-game\.vercel\.app"/);
  });
});
