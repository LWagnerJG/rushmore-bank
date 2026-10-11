import { normalizeRoomCode } from "@/shared/types";

/** Bump with `public/site.webmanifest` / apple-touch icons. */
export const WEB_MANIFEST_ICON_V = "3";

/**
 * iOS WebKit vs Chromium, verified against current docs:
 *
 * - Safari 26 / iOS 26: the manifest is applied (`display`, `name`, `start_url`)
 *   when the user leaves “Open as Web App” on. See WebKit “Safari 26.0”.
 * - Older Add to Home Screen (Web Clip) recorded the *current page URL*, not
 *   the manifest start_url. Apple’s Configuring Web Applications / Web Clip.
 * - MDN: `start_url` is a hint; a relative value resolves against the
 *   *manifest URL*. A path-absolute `/join/ABCD` stays origin-absolute.
 *
 * Serve the join page at `/join/ABCD` *and* set `start_url` to `/join/ABCD`
 * so either rule lands in the room. Keep `id` stable so later launches are
 * the same general Beans app.
 */
export function roomStartUrl(roomRaw?: string | null): string {
  const room = normalizeRoomCode(roomRaw ?? "");
  return room.length === 4 ? `/join/${room}` : "/";
}

export function roomManifestHref(roomRaw?: string | null): string {
  const room = normalizeRoomCode(roomRaw ?? "");
  return room.length === 4
    ? `/manifest.webmanifest?room=${encodeURIComponent(room)}`
    : "/manifest.webmanifest";
}

export type BeansWebManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  display_override: Array<"standalone" | "minimal-ui">;
  orientation: "portrait-primary";
  background_color: string;
  theme_color: string;
  categories: string[];
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose: string;
  }>;
};

export function buildWebManifest(roomRaw?: string | null): BeansWebManifest {
  const v = WEB_MANIFEST_ICON_V;
  return {
    id: `/?icon=v${v}`,
    name: "Beans",
    short_name: "Beans",
    description: "Draft four. Bank beans. Party game for the living room.",
    start_url: roomStartUrl(roomRaw),
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#F5F0E7",
    theme_color: "#F5F0E7",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: `/icons/icon-192.png?v=${v}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-512.png?v=${v}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-192-maskable.png?v=${v}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `/icons/icon-512-maskable.png?v=${v}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
