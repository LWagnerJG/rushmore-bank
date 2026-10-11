/**
 * Vercel → beans-web permanent forward.
 *
 * Production Vercel hosts 308 every path (query preserved) to the Cloudflare
 * frontend, except GET /api/version which must keep answering on Vercel so
 * health checks can compare platforms.
 *
 * Implemented as vercel.json redirects (CDN, Vercel-only). Do not put these
 * rules in next.config — OpenNext would bake them into beans-web and risk a
 * self-redirect. Do not add src/proxy.ts for this: OpenNext's Node middleware
 * on workerd is experimental.
 */

export const BEANS_WEB_ORIGIN = "https://beans-web.beans-lwagner.workers.dev";

export const VERCEL_FORWARD_HOSTS = [
  "beans-game.vercel.app",
  "roundacats.vercel.app",
] as const;

/** Paths that must keep answering on Vercel (no redirect). */
export function isVercelVersionPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/api/version";
}

export function shouldForwardVercelRequest(input: {
  /** `process.env.VERCEL` — `"1"` on Vercel, unset elsewhere. */
  vercel?: string;
  host: string;
  pathname: string;
}): boolean {
  if (input.vercel !== "1") return false;
  const host = input.host.split(":")[0]?.toLowerCase() ?? "";
  if (!(VERCEL_FORWARD_HOSTS as readonly string[]).includes(host)) return false;
  return !isVercelVersionPath(input.pathname);
}

/** Location for a 308. Path and query are preserved; hash is never sent. */
export function beansWebLocation(pathname: string, search = ""): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  return `${BEANS_WEB_ORIGIN}${path}${query}`;
}
