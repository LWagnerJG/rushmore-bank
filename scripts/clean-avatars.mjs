/**
 * Clean sprite-slice leaks from public/avatars/*.webp:
 * keep the largest connected opaque component (+ nearby accessories),
 * drop stray edge fragments, then optically center (COM) on a transparent
 * square with the bean filling ~90% of the canvas.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "public/avatars");
const OUT_SIZE = 192;
const FILL = 0.9;

async function cleanOne(file) {
  const input = path.join(DIR, file);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rgba = new Uint8ClampedArray(data);

  const isOpaque = (i) => {
    const a = rgba[i * 4 + 3];
    if (a < 10) return false;
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    return r + g + b > 30;
  };

  const idx = (x, y) => y * w + x;
  const visited = new Uint8Array(w * h);
  const comps = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (visited[i] || !isOpaque(i)) continue;
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
          if (visited[n] || !isOpaque(n)) continue;
          visited[n] = 1;
          stack.push(n);
        }
      }
      comps.push({ cells, minx, maxx, miny, maxy, size: cells.length });
    }
  }

  if (!comps.length) {
    console.warn("no content", file);
    return;
  }
  comps.sort((a, b) => b.size - a.size);
  const main = comps[0];
  const keep = comps.filter((c, i) => {
    if (i === 0) return true;
    if (c.size < Math.max(20, main.size * 0.015)) return false;
    const cx = (c.minx + c.maxx) / 2;
    const cy = (c.miny + c.maxy) / 2;
    const nearX = cx >= main.minx - 10 && cx <= main.maxx + 10;
    const nearY = cy >= main.miny - 10 && cy <= main.maxy + 10;
    const edgeLeak =
      (c.minx > main.maxx + 4 && c.size < main.size * 0.12) ||
      (c.maxx < main.minx - 4 && c.size < main.size * 0.12) ||
      (c.miny > main.maxy + 4 && c.size < main.size * 0.12);
    return nearX && nearY && !edgeLeak;
  });

  const out = Buffer.alloc(w * h * 4, 0);
  let minx = w,
    maxx = -1,
    miny = h,
    maxy = -1;
  let sx = 0,
    sy = 0,
    mass = 0;
  for (const c of keep) {
    for (const i of c.cells) {
      out[i * 4] = rgba[i * 4];
      out[i * 4 + 1] = rgba[i * 4 + 1];
      out[i * 4 + 2] = rgba[i * 4 + 2];
      out[i * 4 + 3] = rgba[i * 4 + 3];
      const x = i % w;
      const y = (i / w) | 0;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      const a = rgba[i * 4 + 3];
      sx += x * a;
      sy += y * a;
      mass += a;
    }
  }

  for (let y = Math.max(0, miny - 2); y <= Math.min(h - 1, maxy + 2); y++) {
    for (let x = Math.max(0, minx - 2); x <= Math.min(w - 1, maxx + 2); x++) {
      const i = idx(x, y);
      if (out[i * 4 + 3] > 0) continue;
      const a = rgba[i * 4 + 3];
      if (a < 6) continue;
      let adj = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (out[idx(nx, ny) * 4 + 3] > 30) {
          adj = true;
          break;
        }
      }
      if (!adj) continue;
      out[i * 4] = rgba[i * 4];
      out[i * 4 + 1] = rgba[i * 4 + 1];
      out[i * 4 + 2] = rgba[i * 4 + 2];
      out[i * 4 + 3] = a;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      sx += x * a;
      sy += y * a;
      mass += a;
    }
  }

  const comX = mass ? sx / mass : (minx + maxx) / 2;
  const comY = mass ? sy / mass : (miny + maxy) / 2;
  const halfW = Math.max(comX - minx, maxx - comX);
  const halfH = Math.max(comY - miny, maxy - comY);
  const pad = 1;
  const cropMinX = Math.max(0, Math.floor(comX - halfW - pad));
  const cropMaxX = Math.min(w - 1, Math.ceil(comX + halfW + pad));
  const cropMinY = Math.max(0, Math.floor(comY - halfH - pad));
  const cropMaxY = Math.min(h - 1, Math.ceil(comY + halfH + pad));
  const cw = cropMaxX - cropMinX + 1;
  const ch = cropMaxY - cropMinY + 1;
  const cropped = Buffer.alloc(cw * ch * 4, 0);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((cropMinY + y) * w + (cropMinX + x)) * 4;
      const di = (y * cw + x) * 4;
      cropped[di] = out[si];
      cropped[di + 1] = out[si + 1];
      cropped[di + 2] = out[si + 2];
      cropped[di + 3] = out[si + 3];
    }
  }

  const target = Math.round(OUT_SIZE * FILL);
  const scale = Math.min(target / cw, target / ch);
  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));
  const left = Math.round((OUT_SIZE - nw) / 2);
  const top = Math.round((OUT_SIZE - nh) / 2);

  const resized = await sharp(cropped, {
    raw: { width: cw, height: ch, channels: 4 },
  })
    .resize(nw, nh, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

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
    .toFile(input);

  const dropped = comps.length - keep.length;
  console.log(
    `${file}: kept ${keep.length}/${comps.length}, crop ${cw}x${ch} → ${nw}x${nh} @ (${left},${top})${dropped ? ` dropped ${dropped}` : ""}`,
  );
}

async function main() {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".webp"))
    .sort();
  for (const f of files) await cleanOne(f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
