import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(__dirname, "../../../.github/workflows/deploy-partyserver.yml"),
  "utf8",
);

describe("Deploy PartyServer secret sync", () => {
  it("puts JUDGE_SECRET on beans-party after wrangler deploy", () => {
    expect(workflow).toContain("JUDGE_SECRET: ${{ secrets.JUDGE_SECRET }}");
    expect(workflow).toMatch(/put_secret JUDGE_SECRET/);
    expect(workflow).toContain(
      'npx wrangler secret put "$name" --config wrangler.jsonc',
    );
    expect(workflow).toContain(
      "JUDGE_SECRET missing from GitHub secrets",
    );
  });
});
