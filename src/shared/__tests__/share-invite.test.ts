import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { shareInvite } from "@/lib/share-invite";

const lobby = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

describe("lobby share invite", () => {
  it("uses navigator.share when available", async () => {
    const share = vi.fn(async () => undefined);
    const copy = vi.fn(async () => undefined);
    const result = await shareInvite({
      url: "https://beans-game.vercel.app/room/ABCD",
      code: "ABCD",
      share,
      copy,
    });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(copy).not.toHaveBeenCalled();
  });

  it("falls back to copy-link when share is unavailable", async () => {
    const copy = vi.fn(async () => undefined);
    const result = await shareInvite({
      url: "https://beans-game.vercel.app/room/ABCD",
      code: "ABCD",
      share: undefined,
      copy,
    });
    expect(result).toBe("copied");
    expect(copy).toHaveBeenCalledWith(
      "https://beans-game.vercel.app/room/ABCD",
    );
  });

  it("does not copy when the user cancels the share sheet", async () => {
    const share = vi.fn(async () => {
      const err = new Error("Share canceled");
      err.name = "AbortError";
      throw err;
    });
    const copy = vi.fn(async () => undefined);
    const result = await shareInvite({
      url: "https://beans-game.vercel.app/room/ABCD",
      code: "ABCD",
      share,
      copy,
    });
    expect(result).toBe("cancelled");
    expect(copy).not.toHaveBeenCalled();
  });

  it("always shows code + QR + one Share (no Show QR toggle)", () => {
    expect(lobby).toMatch(/>\s*\{copied \? "Copied" : "Share"\}\s*</);
    expect(lobby).not.toMatch(/Show QR|Hide QR|showQR/);
    expect(lobby).toMatch(/lobby-room-code/);
    expect(lobby).toMatch(/lobby-qr/);
    expect(lobby).toMatch(/lobby-invite-row/);
    expect(lobby).toMatch(/shareInvite/);
    expect(lobby).toMatch(/QRCodeSVG/);
    expect(lobby).toMatch(/size=\{108\}/);
    expect(lobby).toMatch(/bgColor="#f5f0e7"/);
    expect(lobby).toMatch(/fgColor="#23483e"/);
    expect(lobby).toMatch(/copyLink|clipboard\.writeText/);
    expect(css).toMatch(/\.lobby-room-code/);
    expect(css).toMatch(/\.lobby-share-btn/);
    expect(css).toMatch(/\.lobby-qr/);
    expect(css).toMatch(/\.lobby-invite-row/);
    const row = css.match(/\.lobby-invite-row\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(row).toMatch(/display:\s*flex/);
    const qr = css.match(/\.lobby-qr\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(qr).toMatch(/108px|96px/);
    const invite = css.match(/\.lobby-invite\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(invite).not.toMatch(/blur\s*\(/);
  });
});
