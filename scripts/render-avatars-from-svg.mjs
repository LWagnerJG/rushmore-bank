/**
 * Regenerate all public/avatars/*.webp from public/bean.svg's kidney path.
 * No usable hi-res sheet exists (git originals are 128×128 pre-cropped cuts).
 * Every avatar shares one identical deep-coral body; accessories are drawn
 * around it. After rasterize, coral-mask normalize locks body W/H/center.
 *
 *   node scripts/render-avatars-from-svg.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public/avatars");
const OUT = 256;

/** Target coral body size / placement after normalize. */
const BODY_W = 114;
const BODY_H = 118;
const BODY_CX = 128;
const BODY_BASE = 193; // bottom of coral body

const C = {
  body: "#E76F4E",
  ink: "#23483E",
  highlight: "#FFDFA5",
  cream: "#FFF8EC",
  gold: "#E0B44A",
  soft: "#F4C95B",
  mint: "#A7D7C2",
  pink: "#F2A0C0",
  purple: "#8B6BBF",
  cyan: "#5ED0E6",
  brown: "#6B3F2A",
  gray: "#8A9096",
  white: "#FFFFFF",
  black: "#1A1A1A",
  green: "#2F6B4F",
  greenMid: "#3F8A64",
  greenDark: "#245A40",
};

/** Exact kidney path from public/bean.svg (local ~128 space). */
const BEAN_PATH =
  "M85 13C109 15 122 39 112 60C106 73 92 71 89 85C85 110 61 123 38 111C11 97 10 61 25 38C40 17 63 10 85 13Z";

/**
 * Shared body transform — every avatar uses this exact group.
 * Path center ≈ (66,68); place body center near (128,134).
 */
const BODY_T = "translate(47.5 57) scale(1.22)";

function beanBody({ eyes = true, mouth = true } = {}) {
  return `
  <g id="bean-body" transform="${BODY_T}">
    <path d="${BEAN_PATH}" fill="${C.body}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M41 36C50 27 59 24 69 24" fill="none" stroke="${C.highlight}" stroke-width="7" stroke-linecap="round"/>
    ${eyes ? `<ellipse cx="47" cy="62" rx="4" ry="6" fill="${C.ink}"/>
    <ellipse cx="65" cy="58" rx="4" ry="6" fill="${C.ink}"/>` : ""}
    ${mouth ? `<path d="M49 78Q60 87 69 74" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>` : ""}
  </g>`;
}

/**
 * Accessories in 256-space.
 * Hats sit ABOVE the body crown (~y=73) so they stay visible in front.
 * Hair/glass that wrap the body go behind.
 */
const ACCESSORIES = {
  aviator: {
    front: `
    <g>
      <ellipse cx="108" cy="128" rx="24" ry="15" fill="${C.gray}" stroke="${C.ink}" stroke-width="3.5"/>
      <ellipse cx="150" cy="126" rx="24" ry="15" fill="${C.gray}" stroke="${C.ink}" stroke-width="3.5"/>
      <path d="M132 128h5" stroke="${C.ink}" stroke-width="3.5"/>
      <path d="M84 128h10M174 126h10" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M92 158c16 20 58 26 80 6" fill="none" stroke="${C.brown}" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="168" cy="172" rx="7" ry="5" fill="${C.brown}" stroke="${C.ink}" stroke-width="2"/>
      <path d="M100 170h64" stroke="${C.gold}" stroke-width="3.5" stroke-linecap="round"/>
    </g>`,
  },
  grill: {
    front: `
    <g>
      <rect x="100" y="146" width="56" height="20" rx="5" fill="${C.gold}" stroke="${C.ink}" stroke-width="2.5"/>
      <path d="M106 152h8M118 152h8M130 152h8M142 152h8" stroke="${C.ink}" stroke-width="2.5"/>
      <circle cx="96" cy="172" r="6" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.5"/>
      <circle cx="110" cy="180" r="6" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.5"/>
      <circle cx="128" cy="184" r="6" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.5"/>
      <circle cx="146" cy="180" r="6" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.5"/>
      <circle cx="160" cy="172" r="6" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.5"/>
      <path d="M96 172h64" stroke="${C.gold}" stroke-width="4"/>
    </g>`,
  },
  headphones: {
    front: `
    <g>
      <path d="M78 120c0-40 30-60 50-60s50 20 50 60" fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>
      <rect x="64" y="116" width="26" height="42" rx="10" fill="#3D6B55" stroke="${C.ink}" stroke-width="3.5"/>
      <rect x="166" y="116" width="26" height="42" rx="10" fill="#3D6B55" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="77" cy="137" r="7" fill="${C.soft}"/>
      <circle cx="179" cy="137" r="7" fill="${C.soft}"/>
    </g>`,
  },
  beanie: {
    // Crown clearly above body; cuff overlaps forehead
    front: `
    <g>
      <path d="M78 96c6-48 94-52 104 0l-4 14H82z" fill="${C.green}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M82 88c8-10 84-12 96 0" fill="none" stroke="${C.greenMid}" stroke-width="5"/>
      <path d="M84 78c8-8 80-8 92 0" fill="none" stroke="${C.greenDark}" stroke-width="4"/>
      <path d="M80 96c8-6 88-6 100 0v16c-10 8-90 8-100 0z" fill="${C.greenMid}" stroke="${C.ink}" stroke-width="3.5"/>
      <ellipse cx="130" cy="52" rx="11" ry="9" fill="${C.green}" stroke="${C.ink}" stroke-width="2.5"/>
    </g>`,
  },
  star: {
    front: `
    <g>
      <path d="M172 88l10 20 22 3-16 16 5 22-21-12-21 12 5-22-16-16 22-3z" fill="${C.soft}" stroke="${C.ink}" stroke-width="3"/>
      <circle cx="182" cy="110" r="2.5" fill="${C.ink}"/>
      <circle cx="190" cy="110" r="2.5" fill="${C.ink}"/>
      <path d="M180 118q6 5 12-1" fill="none" stroke="${C.ink}" stroke-width="2"/>
    </g>`,
  },
  "cyber-visor": {
    front: `
    <g>
      <rect x="82" y="108" width="92" height="32" rx="12" fill="${C.gray}" stroke="${C.ink}" stroke-width="3.5"/>
      <rect x="92" y="116" width="72" height="16" rx="5" fill="${C.cyan}"/>
      <path d="M92 124h72" stroke="${C.white}" stroke-width="2.5" opacity="0.55"/>
      <circle cx="86" cy="124" r="3" fill="${C.soft}"/>
      <circle cx="170" cy="124" r="3" fill="${C.soft}"/>
    </g>`,
  },
  bow: {
    front: `
    <g>
      <path d="M148 78c14-20 34-12 34 6 0 14-12 20-24 14 14 8 16 22 4 30-14 10-28-4-24-18-10 12-26 10-30-6-4-16 12-26 26-16-16-10-14-28 4-26 12 2 16 12 10 16z" fill="${C.pink}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="160" cy="100" r="7" fill="${C.soft}" stroke="${C.ink}" stroke-width="2.5"/>
    </g>`,
  },
  tiara: {
    front: `
    <g>
      <path d="M88 100c12-36 68-36 80 0" fill="none" stroke="${C.gold}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="100" cy="78" r="7" fill="${C.pink}" stroke="${C.ink}" stroke-width="2"/>
      <circle cx="128" cy="58" r="9" fill="${C.cyan}" stroke="${C.ink}" stroke-width="2"/>
      <circle cx="156" cy="78" r="7" fill="${C.pink}" stroke="${C.ink}" stroke-width="2"/>
      <circle cx="142" cy="148" r="8" fill="${C.pink}" opacity="0.9"/>
      <circle cx="154" cy="158" r="6" fill="${C.pink}" opacity="0.75"/>
    </g>`,
  },
  perm: {
    behind: `
    <g>
      <circle cx="96" cy="88" r="22" fill="${C.soft}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="128" cy="70" r="24" fill="${C.soft}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="160" cy="88" r="22" fill="${C.soft}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="84" cy="118" r="16" fill="${C.soft}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="172" cy="118" r="16" fill="${C.soft}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="108" cy="82" r="9" fill="#F7D98A"/>
      <circle cx="148" cy="76" r="9" fill="#F7D98A"/>
    </g>`,
    front: `
    <g>
      <circle cx="174" cy="152" r="6" fill="${C.gold}" stroke="${C.ink}" stroke-width="2"/>
      <circle cx="182" cy="164" r="5" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.5"/>
    </g>`,
  },
  boa: {
    behind: `
    <g>
      <path d="M72 138c-10 24 10 48 34 42 16-2 20-18 10-30 14 16 40 18 52 0 10 18 34 20 44 0 6-14-4-28-18-30-12 20-34 18-44 0-14 18-38 20-52 2-10 12-22 10-26 16z" fill="${C.pink}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="94" cy="172" r="7" fill="#FF7EB6"/>
      <circle cx="130" cy="182" r="8" fill="#FF7EB6"/>
      <circle cx="166" cy="170" r="7" fill="#FF7EB6"/>
    </g>`,
    front: `
    <g>
      <path d="M108 148c8-6 18-2 20 6 2 8-4 12-10 12-10 0-14-10-10-18z" fill="${C.pink}" stroke="${C.ink}" stroke-width="2.5"/>
      <path d="M128 150c8-6 18-2 20 6 2 8-4 12-10 12-10 0-14-10-10-18z" fill="${C.pink}" stroke="${C.ink}" stroke-width="2.5"/>
    </g>`,
  },
  unicorn: {
    front: `
    <g>
      <path d="M130 78l10-52 12 52" fill="${C.cream}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M136 48l5-16 5 16" fill="${C.pink}"/>
      <path d="M86 108c-6-24 10-42 28-40 8 16 2 32-10 42" fill="#F7A8C8" stroke="${C.ink}" stroke-width="3"/>
      <path d="M98 100c0-18 12-32 26-32 4 14 0 28-10 36" fill="#A8D8FF" stroke="${C.ink}" stroke-width="3"/>
      <path d="M108 108c2-16 14-26 26-24 2 12-2 24-12 30" fill="#C8F0A8" stroke="${C.ink}" stroke-width="3"/>
    </g>`,
  },
  spa: {
    front: `
    <g>
      <path d="M80 92c10-34 86-34 100 0v12H80z" fill="${C.cream}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M86 96c10-10 74-10 88 0" fill="none" stroke="#E8D9C4" stroke-width="5"/>
      <ellipse cx="108" cy="120" rx="14" ry="8" fill="#7CB86A" stroke="${C.ink}" stroke-width="2.5" transform="rotate(-18 108 120)"/>
      <ellipse cx="148" cy="118" rx="14" ry="8" fill="#7CB86A" stroke="${C.ink}" stroke-width="2.5" transform="rotate(16 148 118)"/>
      <circle cx="108" cy="120" r="2.5" fill="#3F6B38"/>
      <circle cx="148" cy="118" r="2.5" fill="#3F6B38"/>
    </g>`,
  },
  viking: {
    front: `
    <g>
      <path d="M82 96c8-40 84-40 96 0v10H82z" fill="${C.gray}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M80 94l-22-36 18 8 12 28" fill="${C.cream}" stroke="${C.ink}" stroke-width="3"/>
      <path d="M176 94l22-36-18 8-12 28" fill="${C.cream}" stroke="${C.ink}" stroke-width="3"/>
      <path d="M96 158c10 18 54 20 68 2" fill="#A8452A" stroke="${C.ink}" stroke-width="3"/>
      <path d="M108 166c8 10 36 10 46 0" fill="#C05530"/>
    </g>`,
  },
  cone: {
    front: `
    <g>
      <path d="M128 36l30 62H98z" fill="#FFB300" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M110 72h36" stroke="${C.white}" stroke-width="9"/>
      <path d="M116 52h24" stroke="${C.white}" stroke-width="8"/>
      <ellipse cx="128" cy="98" rx="34" ry="8" fill="#FFB300" stroke="${C.ink}" stroke-width="3"/>
    </g>`,
  },
  "top-hat": {
    front: `
    <g>
      <ellipse cx="128" cy="96" rx="48" ry="10" fill="${C.black}" stroke="${C.ink}" stroke-width="2.5"/>
      <rect x="104" y="28" width="48" height="70" rx="4" fill="${C.black}" stroke="${C.ink}" stroke-width="2.5"/>
      <rect x="104" y="78" width="48" height="12" fill="${C.purple}"/>
      <circle cx="158" cy="118" r="14" fill="none" stroke="${C.gold}" stroke-width="3.5"/>
      <path d="M170 128c10 12 8 26 2 34" fill="none" stroke="${C.gold}" stroke-width="2.5"/>
    </g>`,
  },
  tinfoil: {
    front: `
    <g>
      <path d="M84 98c6-44 84-46 96-2l-8 12H92z" fill="${C.gray}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M92 72l10-10 10 8 12-12 10 10 12-8 10 12" fill="none" stroke="#C0C6CC" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M96 88h68" stroke="#B0B6BC" stroke-width="2.5"/>
      <path d="M100 78h56" stroke="#D0D6DC" stroke-width="2"/>
    </g>`,
  },
  cake: {
    front: `
    <g>
      <rect x="96" y="64" width="64" height="42" rx="7" fill="${C.pink}" stroke="${C.ink}" stroke-width="3.5"/>
      <rect x="96" y="88" width="64" height="12" fill="#F7C4D8"/>
      <ellipse cx="128" cy="64" rx="32" ry="9" fill="#F7C4D8" stroke="${C.ink}" stroke-width="2.5"/>
      <path d="M128 42c0-10 14-10 14 0 0 12-14 16-14 26 0-10-14-14-14-26 0-10 14-10 14 0z" fill="#C43B4A" stroke="${C.ink}" stroke-width="2.5"/>
      <circle cx="128" cy="40" r="4" fill="${C.soft}"/>
      <circle cx="108" cy="76" r="3.5" fill="${C.white}"/>
      <circle cx="148" cy="76" r="3.5" fill="${C.white}"/>
    </g>`,
  },
  mullet: {
    behind: `
    <g>
      <path d="M78 110c-8 10-12 36-4 54 10 6 20-2 16-14 12 20 26 24 36 10 10 16 28 18 38 4 8 12 22 10 26-4 6-20-2-42-14-52-18 12-40 10-56 0-12 8-26 6-42 2z" fill="${C.brown}" stroke="${C.ink}" stroke-width="3.5"/>
      <path d="M92 148c10 22 26 28 40 12" fill="#5A3424"/>
    </g>`,
    front: `
    <g>
      <rect x="104" y="170" width="48" height="20" rx="7" fill="${C.purple}" stroke="${C.ink}" stroke-width="3"/>
      <circle cx="116" cy="180" r="2.5" fill="${C.gold}"/>
      <circle cx="128" cy="180" r="2.5" fill="${C.gold}"/>
      <circle cx="140" cy="180" r="2.5" fill="${C.gold}"/>
    </g>`,
  },
  clown: {
    front: `
    <g>
      <circle cx="128" cy="148" r="10" fill="#E85A4A" stroke="${C.ink}" stroke-width="2.5"/>
      <path d="M96 124c8 10 16 10 24 0" fill="none" stroke="#5B8FD9" stroke-width="5" stroke-linecap="round"/>
      <path d="M136 122c8 10 16 10 24 0" fill="none" stroke="#5B8FD9" stroke-width="5" stroke-linecap="round"/>
      <path d="M80 158c10 22 34 34 50 20 10-8 6-18-4-20 14 12 36 10 48-6 6-8 0-16-10-16-12 16-34 18-50 6-10 12-26 12-34 4z" fill="${C.cream}" stroke="${C.ink}" stroke-width="3.5"/>
      <circle cx="96" cy="168" r="5" fill="${C.pink}"/>
      <circle cx="160" cy="166" r="5" fill="${C.pink}"/>
    </g>`,
  },
  fishbowl: {
    behind: `
    <g>
      <ellipse cx="128" cy="140" rx="68" ry="76" fill="${C.cyan}" fill-opacity="0.2" stroke="${C.ink}" stroke-width="4.5"/>
      <ellipse cx="128" cy="72" rx="44" ry="12" fill="none" stroke="${C.ink}" stroke-width="4.5"/>
      <ellipse cx="128" cy="72" rx="36" ry="7" fill="${C.gray}" opacity="0.4"/>
      <path d="M88 118c22-10 44-4 60 10" fill="none" stroke="${C.white}" stroke-width="3.5" opacity="0.5" stroke-linecap="round"/>
    </g>`,
    front: `
    <g>
      <path d="M94 152c12-10 24-4 28 8 8-14 24-16 34-2 4 10-4 18-14 16-10 12-26 10-34-4-8 4-16 2-14-18z" fill="#FF9A4A" stroke="${C.ink}" stroke-width="2.5"/>
      <circle cx="136" cy="154" r="2.5" fill="${C.ink}"/>
    </g>`,
  },
};

const IDS = Object.keys(ACCESSORIES);

function svgFor(id) {
  const acc = ACCESSORIES[id] || {};
  // Face props that fully cover eyes — omit default dots so nothing peeks.
  const hideEyes = id === "cyber-visor" || id === "spa" || id === "aviator";
  const hideMouth = id === "grill" || id === "clown";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT}" height="${OUT}" viewBox="0 0 ${OUT} ${OUT}">
  ${acc.behind || ""}
  ${beanBody({ eyes: !hideEyes, mouth: !hideMouth })}
  ${acc.front || ""}
</svg>`;
}

function isCoral(r, g, b, a) {
  if (a < 40) return false;
  // Match #E76F4E deep coral; allow mild shading
  if (r < 180 || r > 250) return false;
  if (g < 70 || g > 160) return false;
  if (b < 40 || b > 120) return false;
  if (r <= g + 30) return false;
  if (g <= b) return false;
  return true;
}

function coralBBox(data, w, h) {
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0,
    count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isCoral(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!count) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
    cx: (minX + maxX) / 2,
    base: maxY,
    count,
  };
}

/**
 * Measure coral body on a BODY-ONLY render, then apply that same scale +
 * translate to every avatar. Accessories must not change body sizing —
 * measuring coral after hats/visors shrink the mask and blow up scale.
 */
async function bodyOnlyTransform() {
  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT}" height="${OUT}" viewBox="0 0 ${OUT} ${OUT}">
  ${beanBody()}
</svg>`);
  const png = await sharp(svg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = coralBBox(png.data, png.info.width, png.info.height);
  if (!box) throw new Error("body-only coral mask empty");

  // Uniform scale from both axes so body W and H match targets
  const s = (BODY_W / box.bw + BODY_H / box.bh) / 2;
  return {
    s,
    // placement after scale
    left: Math.round(BODY_CX - box.cx * s),
    top: Math.round(BODY_BASE - box.base * s),
    srcW: png.info.width,
    srcH: png.info.height,
    box,
  };
}

async function applyTransform(pngBuf, xf) {
  const scaledW = Math.max(1, Math.round(xf.srcW * xf.s));
  const scaledH = Math.max(1, Math.round(xf.srcH * xf.s));
  const pad = 128;
  const composed = await sharp({
    create: {
      width: OUT + pad * 2,
      height: OUT + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(pngBuf)
          .resize(scaledW, scaledH, { kernel: "lanczos3" })
          .ensureAlpha()
          .toBuffer(),
        left: xf.left + pad,
        top: xf.top + pad,
      },
    ])
    .png()
    .toBuffer();

  return sharp(composed)
    .extract({ left: pad, top: pad, width: OUT, height: OUT })
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toBuffer();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const xf = await bodyOnlyTransform();
  console.log(
    `body-only coral ${xf.box.bw}×${xf.box.bh} → scale ${xf.s.toFixed(4)} place (${xf.left},${xf.top})`,
  );

  const report = [];
  for (const id of IDS) {
    const svg = Buffer.from(svgFor(id));
    const png = await sharp(svg).png().toBuffer();
    const webp = await applyTransform(png, xf);
    await fs.promises.writeFile(path.join(OUT_DIR, `${id}.webp`), webp);

    // Visible-coral metrics (accessories may cover; used for logging only).
    // Body silhouette identity is guaranteed by shared BODY_T + shared xf.
    const { data, info } = await sharp(webp)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const box = coralBBox(data, info.width, info.height);
    report.push({ id, ...box });
    console.log(
      `wrote ${id.padEnd(12)} visible-coral ${box.bw}×${box.bh} cx=${box.cx.toFixed(1)} base=${box.base}`,
    );
  }

  // uniqueness check — no two files may be byte-identical
  const hashes = new Map();
  for (const id of IDS) {
    const buf = fs.readFileSync(path.join(OUT_DIR, `${id}.webp`));
    const key = buf.toString("binary");
    if (hashes.has(key)) {
      throw new Error(`${id} is byte-identical to ${hashes.get(key)}`);
    }
    hashes.set(key, id);
  }

  // Body-only reference after same transform must hit targets
  const bodySvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT}" height="${OUT}" viewBox="0 0 ${OUT} ${OUT}">
  ${beanBody()}
</svg>`);
  const bodyWebp = await applyTransform(await sharp(bodySvg).png().toBuffer(), xf);
  const bodyRaw = await sharp(bodyWebp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ref = coralBBox(bodyRaw.data, bodyRaw.info.width, bodyRaw.info.height);
  console.log(
    `ref body after xf: ${ref.bw}×${ref.bh} cx=${ref.cx.toFixed(1)} base=${ref.base}`,
  );
  if (
    Math.abs(ref.bw - BODY_W) > 2 ||
    Math.abs(ref.bh - BODY_H) > 2 ||
    Math.abs(ref.cx - BODY_CX) > 2 ||
    Math.abs(ref.base - BODY_BASE) > 2
  ) {
    throw new Error("body-only transform missed target placement");
  }
  console.log(`rendered ${IDS.length} unique avatars; shared body locked`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
