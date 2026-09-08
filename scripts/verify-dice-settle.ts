/**
 * Visual/DOM settle verification for 2D scramble → settle dice.
 *
 * Asserts:
 * - Mid-tumble: tray auth faces empty, dies scramble (changing faces, not settled)
 * - First settled frame === target d1/d2
 * - Later frames stay put (no settle jump)
 *
 * Usage: npx tsx scripts/verify-dice-settle.ts
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts";

type DieSnap = {
  face: string;
  tumbling: string;
  settled: string;
  scrambling: string;
};

async function snapDies(page: import("playwright").Page) {
  return page.evaluate(() => {
    const tray = document.querySelector(".bean-dice-tray") as HTMLElement | null;
    const dies = [...document.querySelectorAll(".bean-pip-die")].map((el) => {
      const h = el as HTMLElement;
      return {
        face: h.dataset.face ?? "",
        tumbling: h.dataset.tumbling ?? "",
        settled: h.dataset.settled ?? "",
        scrambling: h.dataset.scrambling ?? "",
      };
    });
    return {
      phase: tray?.dataset.dicePhase ?? "",
      d1: tray?.dataset.diceD1 ?? "",
      d2: tray?.dataset.diceD2 ?? "",
      scrambling: tray?.dataset.diceScrambling ?? "",
      dies: dies as DieSnap[],
    };
  });
}

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

    // Sample scramble at two mid-tumble moments — faces must change & not settle
    await page.waitForTimeout(350);
    const midA = await snapDies(page);
    await page.waitForTimeout(400);
    const midB = await snapDies(page);

    const midPath = path.join(OUT, `dice-mid-tumble-${t1}x${t2}.png`);
    await page.locator(".bean-dice-tray").screenshot({ path: midPath });

    for (const mid of [midA, midB]) {
      if (mid.phase !== "tumbling") {
        throw new Error(`expected tumbling, got ${JSON.stringify(mid)}`);
      }
      if (mid.d1 !== "" || mid.d2 !== "") {
        throw new Error(`tumble leaked auth faces: ${JSON.stringify(mid)}`);
      }
      if (mid.scrambling !== "1") {
        throw new Error(`tumble not scrambling: ${JSON.stringify(mid)}`);
      }
      if (
        mid.dies.some(
          (d) =>
            d.face === "" ||
            d.tumbling !== "1" ||
            d.settled !== "0" ||
            d.scrambling !== "1",
        )
      ) {
        throw new Error(`scramble die contract broken: ${JSON.stringify(mid)}`);
      }
      if (
        mid.dies.some((d) => {
          const n = Number(d.face);
          return !Number.isInteger(n) || n < 1 || n > 6;
        })
      ) {
        throw new Error(`scramble face out of range: ${JSON.stringify(mid)}`);
      }
    }

    // Scramble must actually flip at least one die across samples
    const scrambled =
      midA.dies[0]?.face !== midB.dies[0]?.face ||
      midA.dies[1]?.face !== midB.dies[1]?.face;
    if (!scrambled) {
      throw new Error(
        `scramble did not change faces: A=${JSON.stringify(midA)} B=${JSON.stringify(midB)}`,
      );
    }

    // Wait for settle
    await page.waitForFunction(
      () =>
        document.querySelector(".bean-dice-tray")?.getAttribute("data-dice-phase") ===
        "settled",
      { timeout: 5000 },
    );

    const settled1 = await snapDies(page);
    const settlePath = path.join(OUT, `dice-settled-${t1}x${t2}.png`);
    await page.locator(".bean-dice-tray").screenshot({ path: settlePath });

    if (settled1.d1 !== String(t1) || settled1.d2 !== String(t2)) {
      throw new Error(
        `first settle mismatch: expected ${t1}+${t2}, got ${JSON.stringify(settled1)}`,
      );
    }
    if (
      settled1.dies[0]?.face !== String(t1) ||
      settled1.dies[1]?.face !== String(t2) ||
      settled1.dies.some((d) => d.settled !== "1" || d.scrambling !== "0")
    ) {
      throw new Error(`die settle contract broken: ${JSON.stringify(settled1)}`);
    }
    if (settled1.scrambling !== "0") {
      throw new Error(`settled tray still scrambling: ${JSON.stringify(settled1)}`);
    }

    // Hold and re-check — faces must not change (no late jump)
    await page.waitForTimeout(600);
    const settled2 = await snapDies(page);
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
      midA,
      midB,
      settled1,
      settled2,
      midPath,
      settlePath,
      scrambleChanged: true,
      ok: true,
    });

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
  console.log(
    `PASS ${results.length} rolls — scramble during tumble, auth settle, no jump`,
  );
  console.log(`report: ${report}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
