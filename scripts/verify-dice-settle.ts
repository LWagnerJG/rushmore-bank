/**
 * Visual/DOM settle verification for 2D dice.
 * Asserts tumble has blank faces, settle matches target, and faces stay put.
 *
 * Usage: npx tsx scripts/verify-dice-settle.ts
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
  page.on("pageerror", (err) => console.error("PAGE ERROR", err));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("CONSOLE", msg.text());
  });
  await page.goto(`${BASE}/dev/dice-lab`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=lab-roll]", { timeout: 10000 });
  await page.waitForTimeout(500);

  const results: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 6; i++) {
    // Read target from status line before roll
    const before = await page.locator("[data-lab-status]").innerText();
    const m = before.match(/target=(\d)\+(\d)/);
    if (!m) throw new Error(`no target in ${before}`);
    const t1 = Number(m[1]);
    const t2 = Number(m[2]);

    await page.locator("[data-testid=lab-roll]").click();
    await page.waitForFunction(
      () =>
        document.querySelector(".bean-dice-tray")?.getAttribute("data-dice-phase") ===
        "tumbling",
      { timeout: 3000 },
    );

    // Mid-tumble sample (~700ms): faces must be blank
    await page.waitForTimeout(700);
    const mid = await page.evaluate(() => {
      const tray = document.querySelector(".bean-dice-tray");
      const dies = [...document.querySelectorAll(".bean-pip-die")].map((el) => ({
        face: (el as HTMLElement).dataset.face ?? "",
        tumbling: (el as HTMLElement).dataset.tumbling ?? "",
      }));
      return {
        phase: (tray as HTMLElement | null)?.dataset.dicePhase ?? "",
        d1: (tray as HTMLElement | null)?.dataset.diceD1 ?? "",
        d2: (tray as HTMLElement | null)?.dataset.diceD2 ?? "",
        dies,
      };
    });
    const midPath = path.join(OUT, `dice-mid-tumble-${t1}x${t2}.png`);
    await page.locator(".bean-dice-tray").screenshot({ path: midPath });

    if (mid.phase !== "tumbling") {
      throw new Error(`expected tumbling, got ${JSON.stringify(mid)}`);
    }
    if (mid.d1 !== "" || mid.d2 !== "") {
      throw new Error(`tumble leaked faces: ${JSON.stringify(mid)}`);
    }
    if (mid.dies.some((d) => d.face !== "" || d.tumbling !== "1")) {
      throw new Error(`tumble die faces not blank: ${JSON.stringify(mid)}`);
    }

    // Wait for settle
    await page.waitForFunction(
      () =>
        document.querySelector(".bean-dice-tray")?.getAttribute("data-dice-phase") ===
        "settled",
      { timeout: 5000 },
    );

    // First settled sample
    const settled1 = await page.evaluate(() => {
      const tray = document.querySelector(".bean-dice-tray") as HTMLElement;
      const dies = [...document.querySelectorAll(".bean-pip-die")].map((el) => ({
        face: (el as HTMLElement).dataset.face ?? "",
        tumbling: (el as HTMLElement).dataset.tumbling ?? "",
      }));
      return {
        phase: tray.dataset.dicePhase,
        d1: tray.dataset.diceD1,
        d2: tray.dataset.diceD2,
        dies,
      };
    });
    const settlePath = path.join(OUT, `dice-settled-${t1}x${t2}.png`);
    await page.locator(".bean-dice-tray").screenshot({ path: settlePath });

    if (settled1.d1 !== String(t1) || settled1.d2 !== String(t2)) {
      throw new Error(
        `first settle mismatch: expected ${t1}+${t2}, got ${JSON.stringify(settled1)}`,
      );
    }
    if (
      settled1.dies[0]?.face !== String(t1) ||
      settled1.dies[1]?.face !== String(t2)
    ) {
      throw new Error(`die data-face mismatch: ${JSON.stringify(settled1)}`);
    }

    // Hold and re-check — faces must not change (no late jump)
    await page.waitForTimeout(600);
    const settled2 = await page.evaluate(() => {
      const tray = document.querySelector(".bean-dice-tray") as HTMLElement;
      const dies = [...document.querySelectorAll(".bean-pip-die")].map((el) => ({
        face: (el as HTMLElement).dataset.face ?? "",
      }));
      return { d1: tray.dataset.diceD1, d2: tray.dataset.diceD2, dies };
    });
    if (
      settled2.d1 !== settled1.d1 ||
      settled2.d2 !== settled1.d2 ||
      settled2.dies[0]?.face !== settled1.dies[0]?.face ||
      settled2.dies[1]?.face !== settled1.dies[1]?.face
    ) {
      throw new Error(
        `LATE JUMP: first=${JSON.stringify(settled1)} later=${JSON.stringify(settled2)}`,
      );
    }

    results.push({
      target: `${t1}+${t2}`,
      mid,
      settled1,
      settled2,
      midPath,
      settlePath,
      ok: true,
    });

    // Next pair
    await page.locator("[data-testid=lab-next]").click();
    await page.waitForFunction(
      () =>
        document.querySelector(".bean-dice-tray")?.getAttribute("data-dice-phase") ===
        "idle",
      { timeout: 3000 },
    );
  }

  const report = path.join(OUT, "dice-settle-verify.json");
  fs.writeFileSync(report, JSON.stringify(results, null, 2));
  console.log(`PASS ${results.length} rolls — no tumble faces, no settle jump`);
  console.log(`report: ${report}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
