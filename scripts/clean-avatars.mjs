/**
 * Clean + normalize public/avatars/*.webp from sprite-slice sources:
 *
 * 1) Isolate the largest opaque component; drop right/below sheet bleed.
 * 2) Detect the orange BEAN BODY (not accessories).
 * 3) Keep body + accessories that sit on/above the body; never keep
 *    foreign pixels below the body baseline or far to the right.
 * 4) Scale so every bean body is the same height, centered on X, sitting
 *    on one shared baseline on a shared transparent canvas.
 *
 * Usage:
 *   SRC_DIR=/tmp/avatar-src node scripts/clean-avatars.mjs
 *   (defaults to reading public/avatars in place)
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public/avatars");
const SRC_DIR = process.env.SRC_DIR
  ? path.resolve(process.env.SRC_DIR)
  : OUT_DIR;

const OUT_SIZE = 192;
/** Bean body height in output pixels (accessories may extend above). */
const BODY_H = 100;
/** Y of bean-body bottom edge (shared baseline). */
const BASELINE = 158;
const BODY_CX = OUT_SIZE / 2;

function isContent(r, g, b, a) {
  if (a < 10) return false;
  return r + g + b > 30;
}

/** Orange / terracotta bean body (not hats, hair, props). */
function isBeanBody(r, g, b, a) {
  if (a < 40) return false;
  // Warm orange kidney; allow slight brown shading.
  if (r < 145 || g < 55 || g > 175 || b > 130) return false;
  if (r <= g + 15) return false;
  if (r <= b + 25) return false;
  return true;
}

function components(rgba, w, h) {
  const visited = new Uint8Array(w * h);
  const comps = [];
  const idx = (x, y) => y * w + x;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (visited[i]) continue;
      const a = rgba[i * 4 + 3];
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      if (!isContent(r, g, b, a)) continue;
      const stack = [i];
      visited[i] = 1;
      const cells = [];
      let minx = x,
        maxx = x,
        miny = y,
        maxy = y;
      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        const cx = cur % w;
        const cy = (cur / w) | 0;
        if (cx < minx) minx = cx;
        if (cx > maxx) maxx = cx;
        if (cy < miny) miny = cy;
        if (cy > maxy) maxy = cy;
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
      comps.push({ cells, minx, maxx, miny, maxy, size: cells.length });
    }
  }
  comps.sort((a, b) => b.size - a.size);
  return comps;
}

function bodyBBox(rgba, w, h, keep) {
  let minx = w,
    maxx = -1,
    miny = h,
    maxy = -1,
    n = 0;
  for (const i of keep) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    if (!isBeanBody(r, g, b, a)) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
    n++;
  }
  if (n < 40) return null;
  return { minx, maxx, miny, maxy, w: maxx - minx + 1, h: maxy - miny + 1, n };
}

/**
 * Isolate one avatar: largest CC, drop sheet-bleed islands, then keep only
 * pixels on/above the bean body (accessories OK; bottom/right foreign out).
 */
function isolate(rgba, w, h) {
  const comps = components(rgba, w, h);
  if (!comps.length) throw new Error("no content");
  const main = comps[0];

  // Secondary islands: allow small top/side accessories near the main bean;
  // never keep below-the-bean or far-right sheet leaks.
  const keepSet = new Set(main.cells);
  for (let i = 1; i < comps.length; i++) {
    const c = comps[i];
    if (c.size < Math.max(8, main.size * 0.008)) continue;
    const cx = (c.minx + c.maxx) / 2;
    const cy = (c.miny + c.maxy) / 2;
    const below = c.miny > main.maxy - 1;
    const rightLeak = c.minx > main.maxx + 2 && c.size < main.size * 0.2;
    const leftLeak = c.maxx < main.minx - 2 && c.size < main.size * 0.2;
    if (below || rightLeak || leftLeak) continue;
    // Must sit near the main bbox (hats / floaty bits).
    const near =
      cx >= main.minx - 6 &&
      cx <= main.maxx + 6 &&
      cy >= main.miny - 14 &&
      cy <= main.maxy + 2;
    if (!near) continue;
    for (const cell of c.cells) keepSet.add(cell);
  }

  // Soft AA halo adjacent to kept opaque pixels (same component neighborhood).
  const halo = [];
  for (const i of keepSet) {
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (keepSet.has(ni)) continue;
      const a = rgba[ni * 4 + 3];
      if (a < 6 || a >= 40) continue;
      halo.push(ni);
    }
  }
  for (const ni of halo) keepSet.add(ni);

  // Bean body from orange pixels inside the keep set.
  let body = bodyBBox(rgba, w, h, keepSet);
  if (!body) {
    // Fallback: use main bbox as body.
    body = {
      minx: main.minx,
      maxx: main.maxx,
      miny: main.miny,
      maxy: main.maxy,
      w: main.maxx - main.minx + 1,
      h: main.maxy - main.miny + 1,
      n: main.size,
    };
  }

  // Hard cut: drop anything more than a few px below the bean body
  // (kills connected sheet-bleed still glued to the main CC).
  const bodyFloor = body.maxy + 3;
  const bodyLeft = body.minx - 10;
  const bodyRight = body.maxx + 10;
  const final = [];
  for (const i of keepSet) {
    const x = i % w;
    const y = (i / w) | 0;
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    if (y > bodyFloor) continue;
    // Far-right vertical slivers (next column) even if connected by 1px.
    if (x > bodyRight + 8 && !isBeanBody(r, g, b, a)) continue;
    if (x < bodyLeft - 8 && !isBeanBody(r, g, b, a) && y > body.miny + 8)
      continue;
    final.push(i);
  }

  // Recompute body after cut.
  body = bodyBBox(rgba, w, h, final) ?? body;

  const out = Buffer.alloc(w * h * 4, 0);
  for (const i of final) {
    out[i * 4] = rgba[i * 4];
    out[i * 4 + 1] = rgba[i * 4 + 1];
    out[i * 4 + 2] = rgba[i * 4 + 2];
    out[i * 4 + 3] = rgba[i * 4 + 3];
  }

  // Content bbox (full character including accessories).
  let minx = w,
    maxx = -1,
    miny = h,
    maxy = -1;
  for (const i of final) {
    const x = i % w;
    const y = (i / w) | 0;
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  }

  return {
    out,
    body,
    content: { minx, maxx, miny, maxy },
    kept: final.length,
    droppedComps: comps.length - 1,
  };
}

async function measureBodyOnCanvas(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let minx = w,
    maxx = -1,
    miny = h,
    maxy = -1,
    n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!isBeanBody(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      n++;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
    }
  }
  if (n < 40) return null;
  return {
    minx,
    maxx,
    miny,
    maxy,
    h: maxy - miny + 1,
    cx: (minx + maxx) / 2,
    baseline: maxy,
  };
}

/** Second pass: lock body height / center / baseline after lanczos AA drift. */
async function lockBodyPose(file) {
  const outPath = path.join(OUT_DIR, file);
  let body = await measureBodyOnCanvas(outPath);
  if (!body) throw new Error(`${file}: no body after render`);

  // Scale about body center so height == BODY_H, then translate to targets.
  const s = BODY_H / body.h;
  const { data, info } = await sharp(outPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  // Find full content bbox to resize.
  let cminx = w,
    cmaxx = -1,
    cminy = h,
    cmaxy = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!isContent(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      if (x < cminx) cminx = x;
      if (x > cmaxx) cmaxx = x;
      if (y < cminy) cminy = y;
      if (y > cmaxy) cmaxy = y;
    }
  }
  const cw = cmaxx - cminx + 1;
  const ch = cmaxy - cminy + 1;
  const cropped = Buffer.alloc(cw * ch * 4, 0);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((cminy + y) * w + (cminx + x)) * 4;
      const di = (y * cw + x) * 4;
      cropped[di] = data[si];
      cropped[di + 1] = data[si + 1];
      cropped[di + 2] = data[si + 2];
      cropped[di + 3] = data[si + 3];
    }
  }
  const nw = Math.max(1, Math.round(cw * s));
  const nh = Math.max(1, Math.round(ch * s));
  const bodyCxIn = (body.cx - cminx) * s;
  const bodyBottomIn = (body.baseline + 0.5 - cminy) * s;
  const left = Math.round(BODY_CX - bodyCxIn);
  const top = Math.round(BASELINE - bodyBottomIn);

  const resized = await sharp(cropped, {
    raw: { width: cw, height: ch, channels: 4 },
  })
    .resize(nw, nh, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

  const pad = Math.max(
    0,
    -left,
    -top,
    left + nw - OUT_SIZE,
    top + nh - OUT_SIZE,
    0,
  );
  if (pad > 0) {
    const big = OUT_SIZE + pad * 2;
    const buf = await sharp({
      create: {
        width: big,
        height: big,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left: left + pad, top: top + pad }])
      .png()
      .toBuffer();
    await sharp(buf)
      .extract({ left: pad, top: pad, width: OUT_SIZE, height: OUT_SIZE })
      .webp({ quality: 92, alphaQuality: 100, effort: 5 })
      .toFile(outPath);
  } else {
    await sharp({
      create: {
        width: OUT_SIZE,
        height: OUT_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left, top }])
      .webp({ quality: 92, alphaQuality: 100, effort: 5 })
      .toFile(outPath);
  }

  body = await measureBodyOnCanvas(outPath);
  return body;
}

async function renderOne(file) {
  const srcPath = path.join(SRC_DIR, file);
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rgba = new Uint8ClampedArray(data);
  const { out, body, content, kept, droppedComps } = isolate(rgba, w, h);

  const scale = BODY_H / body.h;
  const cw = content.maxx - content.minx + 1;
  const ch = content.maxy - content.miny + 1;
  const cropped = Buffer.alloc(cw * ch * 4, 0);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((content.miny + y) * w + (content.minx + x)) * 4;
      const di = (y * cw + x) * 4;
      cropped[di] = out[si];
      cropped[di + 1] = out[si + 1];
      cropped[di + 2] = out[si + 2];
      cropped[di + 3] = out[si + 3];
    }
  }

  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));
  const bodyCxSrc = (body.minx + body.maxx + 1) / 2;
  const bodyBottomSrc = body.maxy + 1;
  const bodyCxInCrop = (bodyCxSrc - content.minx) * scale;
  const bodyBottomInCrop = (bodyBottomSrc - content.miny) * scale;
  const left = Math.round(BODY_CX - bodyCxInCrop);
  const top = Math.round(BASELINE - bodyBottomInCrop);

  const resized = await sharp(cropped, {
    raw: { width: cw, height: ch, channels: 4 },
  })
    .resize(nw, nh, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

  const pad = Math.max(
    0,
    -left,
    -top,
    left + nw - OUT_SIZE,
    top + nh - OUT_SIZE,
  );
  const outPath = path.join(OUT_DIR, file);
  if (pad > 0) {
    const big = OUT_SIZE + pad * 2;
    const bigBuf = await sharp({
      create: {
        width: big,
        height: big,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left: left + pad, top: top + pad }])
      .png()
      .toBuffer();
    await sharp(bigBuf)
      .extract({ left: pad, top: pad, width: OUT_SIZE, height: OUT_SIZE })
      .webp({ quality: 92, alphaQuality: 100, effort: 5 })
      .toFile(outPath);
  } else {
    await sharp({
      create: {
        width: OUT_SIZE,
        height: OUT_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left, top }])
      .webp({ quality: 92, alphaQuality: 100, effort: 5 })
      .toFile(outPath);
  }

  const locked = await lockBodyPose(file);
  console.log(
    `${file}: srcBody ${body.w}x${body.h} → outBody ${locked.h}px @ cx=${locked.cx.toFixed(1)} base=${locked.baseline}, kept ${kept}, droppedIslands ${droppedComps}`,
  );
  return { file, bodyH: locked.h, cx: locked.cx, baseline: locked.baseline };
}

async function main() {
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".webp"))
    .sort();
  if (!files.length) throw new Error(`no webp in ${SRC_DIR}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of files) await renderOne(f);
  console.log(`wrote ${files.length} → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
