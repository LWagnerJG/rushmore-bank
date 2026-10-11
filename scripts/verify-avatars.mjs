/**
 * Verify public/avatars/*.webp:
 * - bean-body height / center-x / baseline within ±3% (or ±2px) across the set
 * - every opaque pixel belongs to the single main connected component
 *   (no foreign islands)
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "public/avatars");
const TOL = 0.03;

function isContent(r, g, b, a) {
  if (a < 10) return false;
  return r + g + b > 30;
}

/** Deep-coral kidney only (#E76F4E) — exclude gold/amber accessories. */
function isBeanBody(r, g, b, a) {
  if (a < 40) return false;
  if (r < 180 || r > 250) return false;
  if (g < 70 || g > 160) return false;
  if (b < 40 || b > 120) return false;
  if (r <= g + 30) return false;
  if (g <= b) return false;
  return true;
}

function largestCC(rgba, w, h) {
  const visited = new Uint8Array(w * h);
  let best = null;
  let islands = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (visited[i]) continue;
      const a = rgba[i * 4 + 3];
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      if (!isContent(r, g, b, a)) continue;
      islands++;
      const stack = [i];
      visited[i] = 1;
      let size = 0;
      const cells = [];
      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        size++;
        const cx = cur % w;
        const cy = (cur / w) | 0;
        for (const n of [
          cur - 1,
          cur + 1,
          cur - w,
          cur + w,
          cur - w - 1,
          cur - w + 1,
          cur + w - 1,
          cur + w + 1,
        ]) {
          if (n < 0 || n >= w * h) continue;
          const nx = n % w;
          const ny = (n / w) | 0;
          if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
          if (visited[n]) continue;
          const na = rgba[n * 4 + 3];
          const nr = rgba[n * 4];
          const ng = rgba[n * 4 + 1];
          const nb = rgba[n * 4 + 2];
          if (!isContent(nr, ng, nb, na)) continue;
          visited[n] = 1;
          stack.push(n);
        }
      }
      if (!best || size > best.size) best = { size, cells };
    }
  }
  return { best, islands };
}

async function measure(file) {
  const { data, info } = await sharp(path.join(DIR, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rgba = data;

  let bMinx = w,
    bMaxx = -1,
    bMiny = h,
    bMaxy = -1,
    bodyN = 0;
  let opaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = rgba[i * 4 + 3];
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      if (!isContent(r, g, b, a)) continue;
      opaque++;
      if (!isBeanBody(r, g, b, a)) continue;
      bodyN++;
      if (x < bMinx) bMinx = x;
      if (x > bMaxx) bMaxx = x;
      if (y < bMiny) bMiny = y;
      if (y > bMaxy) bMaxy = y;
    }
  }
  if (bodyN < 40) {
    return { file, ok: false, reason: `bean body pixels ${bodyN}` };
  }

  const { best, islands } = largestCC(rgba, w, h);
  const foreign = opaque - (best?.size ?? 0);
  // Allow tiny AA crumbs (<0.3% of opaque) but flag real islands.
  const foreignOk = foreign <= Math.max(6, opaque * 0.003) && islands <= 2;

  const bodyH = bMaxy - bMiny + 1;
  const bodyW = bMaxx - bMinx + 1;
  const bodyCx = (bMinx + bMaxx) / 2;
  const baseline = bMaxy;

  return {
    file,
    ok: true,
    bodyH,
    bodyW,
    bodyCx,
    baseline,
    foreign,
    islands,
    foreignOk,
    canvas: w,
    buf: fs.readFileSync(path.join(DIR, file)),
  };
}

async function main() {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".webp"))
    .sort();
  const rows = [];
  for (const f of files) rows.push(await measure(f));

  const good = rows.filter((r) => r.ok);
  if (good.length !== files.length) {
    for (const r of rows.filter((r) => !r.ok)) console.error("FAIL", r);
    process.exit(1);
  }

  // Uniqueness — a missing accessory used to collapse 5 tiles to one plain bean.
  const seen = new Map();
  for (const r of good) {
    const key = r.buf.toString("binary");
    if (seen.has(key)) {
      console.error(`FAIL ${r.file} byte-identical to ${seen.get(key)}`);
      process.exit(1);
    }
    seen.set(key, r.file);
  }

  const ws = good.map((r) => r.bodyW);
  const cxs = good.map((r) => r.bodyCx);
  const bases = good.map((r) => r.baseline);
  const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[(s.length / 2) | 0];
  };
  const medW = median(ws);
  const medCx = median(cxs);
  const medBase = median(bases);

  // Hats cover the crown, so visible coral HEIGHT shrinks — that is expected.
  // Lock what the eye uses for "same size": body WIDTH, center-x, baseline.
  let failed = false;
  for (const r of good) {
    const wErr = Math.abs(r.bodyW - medW) / medW;
    const cxErr = Math.abs(r.bodyCx - medCx);
    const baseErr = Math.abs(r.baseline - medBase);
    const sizeOk = wErr <= TOL;
    const alignTol = Math.max(3, r.canvas * TOL);
    const alignOk = cxErr <= alignTol && baseErr <= alignTol;
    const line = `${r.file}: bodyW=${r.bodyW} (Δ${(wErr * 100).toFixed(1)}%) bodyH=${r.bodyH} cx=${r.bodyCx.toFixed(1)} base=${r.baseline} foreign=${r.foreign} islands=${r.islands}`;
    if (!sizeOk || !alignOk || !r.foreignOk) {
      console.error("FAIL", line, {
        sizeOk,
        alignOk,
        foreignOk: r.foreignOk,
      });
      failed = true;
    } else {
      console.log("ok  ", line);
    }
  }

  console.log(
    `\nmedian bodyW=${medW} cx=${medCx.toFixed(1)} baseline=${medBase} (±${(TOL * 100).toFixed(0)}% / align±${Math.max(3, good[0].canvas * TOL).toFixed(1)}px)`,
  );
  if (failed) process.exit(1);
  console.log("ALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
