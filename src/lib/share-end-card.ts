/**
 * Client-side shareable end card (1080×1350 portrait).
 * Canvas only — no heavy libraries. Share via navigator.share({ files })
 * with a download fallback.
 */

import {
  beanAvatarSrc,
  normalizeAvatarId,
  type BeanAvatarId,
} from "@/shared/bean-avatars";
import { RULES } from "@/shared/rules";
import type { Player, RoundRecap } from "@/shared/types";

export const SHARE_CARD_W = 1080;
export const SHARE_CARD_H = 1350;

export type ShareEndCardResult = "shared" | "downloaded" | "cancelled" | "failed";

export type ShareEndCardInput = {
  ranked: Player[];
  roundRecaps: RoundRecap[];
  createdAt: number;
  currencyName?: string;
  tagline?: string;
  /** Override image loader (tests). */
  loadImage?: (src: string) => Promise<CanvasImageSource | null>;
};

const COLORS = {
  bgTop: "#FFF8EC",
  bgMid: "#F5F0E7",
  bgBot: "#EBE4D6",
  ink: "#23483E",
  muted: "#4C6E64",
  coral: "#E76F4E",
  coralInk: "#A8452A",
  mint: "#A7D7C2",
  foam: "#FFFFFF",
  softLine: "rgba(35, 72, 62, 0.10)",
};

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "NotAllowedError";
}

function formatCardDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toDateString();
  }
}

function displayFont(): string {
  if (typeof document === "undefined") return "Sora, Nunito, system-ui, sans-serif";
  const root = getComputedStyle(document.documentElement);
  const display = root.getPropertyValue("--font-display").trim();
  const body = root.getPropertyValue("--font-body").trim();
  return [display, body, "system-ui", "sans-serif"].filter(Boolean).join(", ");
}

function loadImageBrowser(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawBeanLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 128;
  ctx.scale(s, s);
  // Body
  ctx.beginPath();
  ctx.moveTo(85, 13);
  ctx.bezierCurveTo(109, 15, 122, 39, 112, 60);
  ctx.bezierCurveTo(106, 73, 92, 71, 89, 85);
  ctx.bezierCurveTo(85, 110, 61, 123, 38, 111);
  ctx.bezierCurveTo(11, 97, 10, 61, 25, 38);
  ctx.bezierCurveTo(40, 17, 63, 10, 85, 13);
  ctx.closePath();
  ctx.fillStyle = COLORS.coral;
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 6;
  ctx.stroke();
  // Highlight
  ctx.beginPath();
  ctx.moveTo(41, 36);
  ctx.bezierCurveTo(50, 27, 59, 24, 69, 24);
  ctx.strokeStyle = "#FFDFA5";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.stroke();
  // Eyes
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.ellipse(47, 62, 4, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(65, 58, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.beginPath();
  ctx.moveTo(49, 78);
  ctx.quadraticCurveTo(60, 87, 69, 74);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1]!, maxWidth);
  }
  return lines.length ? lines : [""];
}

async function loadAvatars(
  ranked: Player[],
  loadImage: (src: string) => Promise<CanvasImageSource | null>,
): Promise<Map<string, CanvasImageSource>> {
  const out = new Map<string, CanvasImageSource>();
  await Promise.all(
    ranked.map(async (p) => {
      const id: BeanAvatarId = normalizeAvatarId(p.avatarId, p.id);
      const img = await loadImage(beanAvatarSrc(id));
      if (img) out.set(p.id, img);
    }),
  );
  return out;
}

/**
 * Render the portrait end card. Pure drawing + optional image loads.
 */
export async function renderShareEndCard(
  input: ShareEndCardInput,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_W;
  canvas.height = SHARE_CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const font = displayFont();
  const currency = input.currencyName ?? RULES.currencyName;
  const tagline = input.tagline ?? RULES.tagline;
  const loadImage = input.loadImage ?? loadImageBrowser;
  const avatars = await loadAvatars(input.ranked, loadImage);

  // Atmosphere — soft vertical wash, no hard lines.
  const bg = ctx.createLinearGradient(0, 0, 0, SHARE_CARD_H);
  bg.addColorStop(0, COLORS.bgTop);
  bg.addColorStop(0.45, COLORS.bgMid);
  bg.addColorStop(1, COLORS.bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHARE_CARD_W, SHARE_CARD_H);

  // Soft mint glow top-right
  const glow = ctx.createRadialGradient(900, 80, 20, 900, 120, 420);
  glow.addColorStop(0, "rgba(167, 215, 194, 0.45)");
  glow.addColorStop(1, "rgba(167, 215, 194, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_CARD_W, 520);

  const padX = 64;
  let y = 56;

  // Logo row
  drawBeanLogo(ctx, padX, y, 88);
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 64px ${font}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Beans", padX + 104, y + 48);
  y += 112;

  // Tagline
  ctx.fillStyle = COLORS.coralInk;
  ctx.font = `700 36px ${font}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(tagline, padX, y);
  y += 44;

  // Date
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 26px ${font}`;
  ctx.fillText(formatCardDate(input.createdAt), padX, y);
  y += 48;

  const winners = input.ranked.filter(
    (p, _, arr) => p.stones === (arr[0]?.stones ?? 0) && p.role === "player",
  );
  const winnerLabel =
    winners.length > 1
      ? `Winners · ${winners.map((w) => w.name).join(" & ")}`
      : winners[0]
        ? `Winner · ${winners[0].name}`
        : "Winner";

  // Winner chip
  ctx.font = `800 34px ${font}`;
  const winText = fitText(ctx, winnerLabel, SHARE_CARD_W - padX * 2 - 48);
  const winW = ctx.measureText(winText).width + 48;
  const winH = 56;
  roundRect(ctx, padX, y, winW, winH, 28);
  ctx.fillStyle = "rgba(231, 111, 78, 0.14)";
  ctx.fill();
  ctx.fillStyle = COLORS.coralInk;
  ctx.textBaseline = "middle";
  ctx.fillText(winText, padX + 24, y + winH / 2);
  y += winH + 36;

  // Standings
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 28px ${font}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Final standings", padX, y);
  y += 28;

  const players = input.ranked.filter((p) => p.role === "player");
  const rowH = players.length > 6 ? 52 : 60;
  const avatarSize = players.length > 6 ? 40 : 48;

  players.forEach((p, i) => {
    const rank = i + 1;
    const rowY = y + i * rowH;
    // Soft rank wash for #1
    if (rank === 1) {
      roundRect(ctx, padX - 8, rowY - 4, SHARE_CARD_W - padX * 2 + 16, rowH - 4, 16);
      ctx.fillStyle = "rgba(167, 215, 194, 0.35)";
      ctx.fill();
    }

    ctx.fillStyle = COLORS.muted;
    ctx.font = `800 26px ${font}`;
    ctx.textBaseline = "middle";
    ctx.fillText(String(rank), padX, rowY + rowH / 2 - 2);

    const ax = padX + 40;
    const ay = rowY + (rowH - avatarSize) / 2 - 2;
    const avatar = avatars.get(p.id);
    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.mint;
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = `800 ${Math.round(avatarSize * 0.45)}px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText(
        (p.name.trim()[0] || "?").toUpperCase(),
        ax + avatarSize / 2,
        ay + avatarSize / 2 + 1,
      );
      ctx.textAlign = "left";
    }

    ctx.fillStyle = COLORS.ink;
    ctx.font = `800 28px ${font}`;
    ctx.textBaseline = "middle";
    const nameX = ax + avatarSize + 16;
    const nameMax = SHARE_CARD_W - padX - nameX - 160;
    ctx.fillText(fitText(ctx, p.name, nameMax), nameX, rowY + rowH / 2 - 2);

    ctx.fillStyle = COLORS.coralInk;
    ctx.font = `800 28px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(
      `${p.stones} ${currency}`,
      SHARE_CARD_W - padX,
      rowY + rowH / 2 - 2,
    );
    ctx.textAlign = "left";
  });

  y += players.length * rowH + 20;

  // Rounds — scale density to fit remaining height
  const recaps = input.roundRecaps.slice().sort((a, b) => a.round - b.round);
  const remaining = SHARE_CARD_H - y - 48;
  const rounds = recaps.length || 1;
  const budgetPerRound = remaining / rounds;
  const compact = budgetPerRound < 160 || players.length > 5 || rounds > 4;

  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 ${compact ? 24 : 28}px ${font}`;
  ctx.fillText("The Rushmores", padX, y);
  y += compact ? 22 : 28;

  for (const recap of recaps) {
    if (y > SHARE_CARD_H - 40) break;
    ctx.fillStyle = COLORS.coralInk;
    ctx.font = `800 ${compact ? 22 : 24}px ${font}`;
    const topicLine = fitText(
      ctx,
      `R${recap.round} · ${recap.topicText}`,
      SHARE_CARD_W - padX * 2,
    );
    ctx.fillText(topicLine, padX, y);
    y += compact ? 22 : 26;

    for (const roster of recap.rosters) {
      if (y > SHARE_CARD_H - 28) break;
      const picks = roster.picks.slice(0, 4);
      const pickStr = picks.length
        ? picks.map((pk) => pk.trim()).filter(Boolean).join(" · ")
        : "—";
      ctx.fillStyle = COLORS.muted;
      ctx.font = `700 ${compact ? 18 : 20}px ${font}`;
      const line = fitText(
        ctx,
        `${roster.playerName}: ${pickStr}`,
        SHARE_CARD_W - padX * 2,
      );
      ctx.fillText(line, padX, y);
      y += compact ? 20 : 24;
    }
    y += compact ? 8 : 12;
  }

  // Footer whisper
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 20px ${font}`;
  ctx.textAlign = "center";
  ctx.globalAlpha = 0.85;
  ctx.fillText("beans-web.beans-lwagner.workers.dev", SHARE_CARD_W / 2, SHARE_CARD_H - 28);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/**
 * Share the end-card PNG via Web Share API files, else download.
 */
export async function shareEndCard(opts: {
  blob: Blob;
  filename?: string;
  title?: string;
  text?: string;
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  download?: (blob: Blob, filename: string) => void;
}): Promise<ShareEndCardResult> {
  const filename = opts.filename ?? "beans-rushmore.png";
  const title = opts.title ?? "Beans";
  const text = opts.text ?? RULES.tagline;
  const file = new File([opts.blob], filename, { type: "image/png" });
  const data: ShareData = { files: [file], title, text };

  const share =
    opts.share ??
    (typeof navigator !== "undefined" && navigator.share
      ? navigator.share.bind(navigator)
      : undefined);
  const canShare =
    opts.canShare ??
    (typeof navigator !== "undefined" && navigator.canShare
      ? navigator.canShare.bind(navigator)
      : undefined);

  if (share && (!canShare || canShare(data))) {
    try {
      await share(data);
      return "shared";
    } catch (err) {
      if (isAbortError(err)) return "cancelled";
      // Fall through to download.
    }
  }

  try {
    (opts.download ?? downloadBlob)(opts.blob, filename);
    return "downloaded";
  } catch {
    return "failed";
  }
}

/** Build + share from room state pieces. */
export async function shareGameEndCard(
  input: ShareEndCardInput,
): Promise<ShareEndCardResult> {
  const canvas = await renderShareEndCard(input);
  const blob = await canvasToPngBlob(canvas);
  const winner = input.ranked[0]?.name ?? "Beans";
  return shareEndCard({
    blob,
    text: `${RULES.tagline} ${winner} took the beans.`,
  });
}
