/** Build / host freshness checks for stale PWA + old PartyKit clients. */

export type VersionPayload = {
  sha: string;
  partyHost: string;
  /** ISO timestamp when this payload was generated (server). */
  generatedAt: string;
};

export type StaleReason = "build" | "party-host" | null;

const LEGACY_PARTYKIT_HOST_RE =
  /(^|\.)partykit\.dev$|(^|\.)partykit\.cloud$|partykit\.com$/i;

export function normalizeSha(sha: string | null | undefined): string {
  if (!sha) return "";
  return sha.trim().toLowerCase().slice(0, 8);
}

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/** True when a baked-in host still points at hosted PartyKit. */
export function isLegacyPartyHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  if (LEGACY_PARTYKIT_HOST_RE.test(h)) return true;
  // Old cutover placeholder that never received a real workers.dev host
  if (h.includes("your_subdomain") || h.includes("your-subdomain")) return true;
  return false;
}

/**
 * Compare the SHA/host baked into this JS bundle against a fresh /api/version
 * response. Mismatched SHA ⇒ stale bundle (SW/CDN). Legacy or mismatched
 * party host ⇒ old realtime endpoint.
 */
export function detectStaleClient(input: {
  clientSha: string;
  clientPartyHost: string;
  server: VersionPayload;
}): { stale: boolean; reason: StaleReason } {
  const clientSha = normalizeSha(input.clientSha);
  const serverSha = normalizeSha(input.server.sha);
  const clientHost = normalizeHost(input.clientPartyHost);
  const serverHost = normalizeHost(input.server.partyHost);

  if (isLegacyPartyHost(clientHost)) {
    return { stale: true, reason: "party-host" };
  }
  if (serverHost && clientHost && serverHost !== clientHost) {
    return { stale: true, reason: "party-host" };
  }
  // Only compare SHAs when both sides know a real deploy SHA (not "local").
  if (
    clientSha &&
    serverSha &&
    clientSha !== "local" &&
    serverSha !== "local" &&
    clientSha !== serverSha
  ) {
    return { stale: true, reason: "build" };
  }
  return { stale: false, reason: null };
}

export function staleReloadMessage(reason: StaleReason): string {
  if (reason === "party-host") {
    return "This install is pointing at an old game server. Reloading to update…";
  }
  if (reason === "build") {
    return "A newer Beans build is available. Reloading…";
  }
  return "Updating Beans…";
}
