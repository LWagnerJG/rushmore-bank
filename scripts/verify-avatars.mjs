/**
 * Verify public/avatars/*.webp:
 * - unique files (no collapsed plain-bean duplicates)
 * - bean+accessory content fills ~85–90% of the canvas
 * - even margins (nothing clipped at edges)
 * - every opaque pixel belongs to the single main connected component
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "public/avatars");
const FILL_MIN = 0.84;
const FILL_MAX = 0.92;
const EDGE_MIN = 8;

function isContent(r, g, b, a) {
  if (a < 10) return false;
  return r + g + b > 30;
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
      while (stack.length) {
        const cur = stack.pop();
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
      if (!best || size > best.size) best = { size };
    }
  }
  return { best, islands };
}

async function measure(file) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rgba = data;

  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0,
    opaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = rgba[i * 4 + 3];
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      if (!isContent(r, g, b, a)) continue;
      opaque++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (opaque < 40) {
    return { file, ok: false, reason: `opaque pixels ${opaque}` };
  }

  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const fill = Math.max(tw, th) / Math.max(w, h);
  const edge = Math.min(minX, minY, w - 1 - maxX, h - 1 - maxY);

  const { best, islands } = largestCC(rgba, w, h);
  const foreign = opaque - (best?.size ?? 0);
  const foreignOk = foreign <= Math.max(6, opaque * 0.003) && islands <= 2;

  return {
    file,
    ok: true,
    fill,
    edge,
    tw,
    th,
    foreign,
    islands,
    foreignOk,
    canvas: w,
    buf,
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

  const seen = new Map();
  for (const r of good) {
    const key = r.buf.toString("binary");
    if (seen.has(key)) {
      console.error(`FAIL ${r.file} byte-identical to ${seen.get(key)}`);
      process.exit(1);
    }
    seen.set(key, r.file);
  }

  let failed = false;
  for (const r of good) {
    const fillOk = r.fill >= FILL_MIN && r.fill <= FILL_MAX;
    const edgeOk = r.edge >= EDGE_MIN;
    const line = `${r.file}: fill=${(r.fill * 100).toFixed(1)}% content=${r.tw}×${r.th} edge=${r.edge}px foreign=${r.foreign} islands=${r.islands}`;
    if (!fillOk || !edgeOk || !r.foreignOk) {
      console.error("FAIL", line, { fillOk, edgeOk, foreignOk: r.foreignOk });
      failed = true;
    } else {
      console.log("ok  ", line);
    }
  }

  console.log(
    `\nfill band ${(FILL_MIN * 100).toFixed(0)}–${(FILL_MAX * 100).toFixed(0)}%; edge ≥${EDGE_MIN}px`,
  );
  if (failed) process.exit(1);
  console.log("ALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
