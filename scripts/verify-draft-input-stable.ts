/**
 * WebKit: draft pick input must not jump while typing under a simulated keyboard.
 *
 * Viewport 390×844; visualViewport height reduced (keyboard). Focus #selected-pick,
 * type 10 characters, assert getBoundingClientRect().top stays within ±1px and
 * window.scrollY stays 0.
 *
 * Usage: npx tsx scripts/verify-draft-input-stable.ts
 */
import http from "node:http";
import { webkit } from "playwright";

const PORT = 8768;
const VIEW_W = 390;
const VIEW_H = 844;
const KEYBOARD_H = 336;

const FIXTURE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"/>
<style>
  :root { --app-h: ${VIEW_H}px; --tap-min: 44px; --text: #23483e; --muted: #6b7c74; --coral: #e76f4e; --bg: #f5f0e7; }
  html, body {
    margin: 0; padding: 0; overflow: hidden; height: var(--app-h);
    background: var(--bg); color: var(--text);
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .app-shell {
    height: var(--app-h); max-width: 28rem; margin: 0 auto;
    display: flex; flex-direction: column; overflow: hidden;
    padding: 0 1rem;
  }
  .room-phase-scroll {
    flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
  }
  .draft-panel { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 1rem; }
  .draft-turn-line {
    margin: 0; min-height: 1.4em; font-weight: 800; font-size: 1.05rem; color: var(--muted);
  }
  .draft-board { height: 220px; border-radius: 1rem; background: #fff; }
  .stash-surface {
    border-radius: 1.15rem; background: #fff; padding: 0.9rem 0.8rem 1rem;
    border: 1.5px solid rgba(35, 72, 62, 0.16);
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .draft-stash-tray {
    position: relative; min-height: 3rem; max-height: 5.5rem;
    overflow-x: hidden; overflow-y: auto;
  }
  .field, .draft-pick-input {
    width: 100%; box-sizing: border-box;
    border-radius: 0.85rem; border: 1.5px solid rgba(35, 72, 62, 0.18);
    background: rgba(255,255,255,0.72); padding: 0.85rem 1rem;
    font-size: max(16px, 1rem); color: var(--text); outline: none;
    min-height: var(--tap-min);
  }
  .draft-input-status {
    margin: 0; min-height: 1.35em; font-size: 0.875rem; font-weight: 700; line-height: 1.35;
  }
  .btn { min-height: var(--tap-min); border: 0; border-radius: 0.95rem;
    background: var(--coral); color: #fff; font-weight: 800; }
</style>
</head>
<body>
<main class="app-shell">
  <div class="room-phase-scroll" id="scroll">
    <div class="draft-panel">
      <p class="draft-turn-line" id="status">Pat picking · you’re up in 2</p>
      <div class="draft-board" aria-hidden="true"></div>
      <section class="stash-surface">
        <div class="draft-stash-tray" id="tray"></div>
        <label class="sr-only" for="selected-pick">Your draft pick</label>
        <input id="selected-pick" class="field draft-pick-input" placeholder="Park a pick in your stash"
          maxlength="48" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>
        <p class="draft-input-status" id="input-status">&nbsp;</p>
        <button type="button" class="btn" id="cta">Stash it</button>
      </section>
    </div>
  </div>
</main>
<script>
(function () {
  // Mirrors src/shared/viewport-height shouldFreezeAppHeight + NoPullToRefresh syncAppH
  var frozenPx = null;
  function isEditable(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
      var type = (el.type || "text").toLowerCase();
      return ["button","submit","reset","checkbox","radio","file","range","color","hidden","image"].indexOf(type) < 0;
    }
    return !!el.isContentEditable;
  }
  function shouldFreeze(editableFocused) { return editableFocused === true; }
  function syncAppH() {
    var inner = window.innerHeight;
    var vv = window.visualViewport ? window.visualViewport.height : null;
    var editableFocused = isEditable(document.activeElement);
    if (shouldFreeze(editableFocused)) {
      if (frozenPx == null) {
        var existing = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-h"));
        frozenPx = (isFinite(existing) && existing > 0) ? Math.round(existing) : Math.round(inner);
        document.documentElement.style.setProperty("--app-h", frozenPx + "px");
      }
      return;
    }
    frozenPx = null;
    var px = (typeof vv === "number" && isFinite(vv) && vv > 0) ? Math.round(vv) : Math.round(inner);
    if (px > 0) document.documentElement.style.setProperty("--app-h", px + "px");
  }
  document.addEventListener("focusin", function (e) {
    if (!isEditable(e.target)) return;
    window.scrollTo(0, 0);
    syncAppH();
  });
  document.addEventListener("focusout", function () {
    window.scrollTo(0, 0);
    syncAppH();
  });
  window.addEventListener("resize", syncAppH);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppH);
    window.visualViewport.addEventListener("scroll", syncAppH);
  }
  syncAppH();

  // Typing feedback that must NOT shift layout (reserved status slot).
  var input = document.getElementById("selected-pick");
  var status = document.getElementById("input-status");
  input.addEventListener("input", function () {
    var v = input.value.trim().toLowerCase();
    if (v === "taken") status.textContent = "Taken — try another.";
    else status.innerHTML = "&nbsp;";
  });
})();
</script>
</body>
</html>`;

async function main() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(FIXTURE);
  });
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });

    // Simulate iOS software keyboard shrinking visualViewport.
    // Use string evaluate bodies so tsx/esbuild __name helpers are not injected.
    await page.evaluate(
      `(([viewH, keyboardH]) => {
        const height = viewH - keyboardH;
        const listeners = {};
        const vv = {
          height: height,
          width: 390,
          offsetTop: 0,
          offsetLeft: 0,
          scale: 1,
          addEventListener: function (type, cb) {
            (listeners[type] || (listeners[type] = [])).push(cb);
          },
          removeEventListener: function () {},
          dispatch: function (type) {
            (listeners[type] || []).forEach(function (cb) { cb(); });
          },
        };
        Object.defineProperty(window, "visualViewport", {
          configurable: true,
          get: function () { return vv; },
        });
        window.__mockVv = vv;
      })(${JSON.stringify([VIEW_H, KEYBOARD_H])})`,
    );

    const input = page.locator("#selected-pick");
    await input.click();
    await page.evaluate(`(() => {
      window.scrollTo(0, 0);
      if (window.__mockVv) window.__mockVv.dispatch("resize");
    })()`);

    const box0 = await input.boundingBox();
    const top0 = box0?.y ?? NaN;
    const metrics0 = (await page.evaluate(`({
      scrollY: window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0,
      appH: getComputedStyle(document.documentElement).getPropertyValue("--app-h").trim(),
      fontSize: parseFloat(getComputedStyle(document.getElementById("selected-pick")).fontSize),
    })`)) as { scrollY: number; appH: string; fontSize: number };

    const typed = "abcdefghij";
    for (const ch of typed) {
      await page.keyboard.type(ch, { delay: 15 });
      await page.evaluate(`(() => {
        if (window.__mockVv) {
          window.__mockVv.dispatch("resize");
          window.__mockVv.dispatch("scroll");
        }
      })()`);
    }

    const box1 = await input.boundingBox();
    const top1 = box1?.y ?? NaN;
    const metrics1 = (await page.evaluate(`({
      scrollY: window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0,
      appH: getComputedStyle(document.documentElement).getPropertyValue("--app-h").trim(),
      value: document.getElementById("selected-pick").value,
      fontSize: parseFloat(getComputedStyle(document.getElementById("selected-pick")).fontSize),
    })`)) as {
      scrollY: number;
      appH: string;
      value: string;
      fontSize: number;
    };

    const delta = Math.abs(top1 - top0);
    const errors: string[] = [];
    if (!Number.isFinite(top0) || !Number.isFinite(top1)) {
      errors.push(`could not measure input top (before=${top0}, after=${top1})`);
    }
    if ((metrics1.value || "").length < 10) {
      errors.push(`expected ≥10 chars, got "${metrics1.value}"`);
    }
    if (delta > 1) {
      errors.push(`input top jumped ${delta.toFixed(2)}px (${top0} → ${top1})`);
    }
    if (metrics0.scrollY !== 0 || metrics1.scrollY !== 0) {
      errors.push(
        `window.scrollY not 0 (before=${metrics0.scrollY}, after=${metrics1.scrollY})`,
      );
    }
    if (metrics0.appH !== metrics1.appH) {
      errors.push(`--app-h changed while focused (${metrics0.appH} → ${metrics1.appH})`);
    }
    if (metrics1.fontSize < 16) {
      errors.push(`font-size ${metrics1.fontSize}px < 16px`);
    }

    if (errors.length) {
      console.error("FAIL draft input stability:\n- " + errors.join("\n- "));
      process.exitCode = 1;
    } else {
      console.log(
        `OK draft input stable: top=${top0.toFixed(1)}Δ${delta.toFixed(2)} scrollY=0 --app-h=${metrics0.appH} font=${metrics1.fontSize}px`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
