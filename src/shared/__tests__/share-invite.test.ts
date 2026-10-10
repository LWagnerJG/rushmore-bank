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

  it("keeps one big Share, Copied confirmation, big code, QR behind Show QR", () => {
    expect(lobby).toMatch(/>\s*\{copied \? "Copied" : "Share"\}\s*</);
    expect(lobby).toMatch(/Show QR/);
    expect(lobby).toMatch(/lobby-room-code/);
    expect(lobby).toMatch(/shareInvite/);
    expect(lobby).toMatch(/QRCodeSVG/);
    expect(css).toMatch(/\.lobby-room-code/);
    expect(css).toMatch(/\.lobby-share-btn/);
  });
});
