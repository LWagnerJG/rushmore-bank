export const DEFAULT_PARTYKIT_HOST = "rushmore-bank.lwagnerjg.partykit.dev";

/** A preview must never silently connect its rooms to the production server. */
export function resolvePartyHost(configured: string | undefined, environment: string | undefined): string {
  const host = (configured || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (environment === "preview" || environment === "test") {
    return host && host.toLowerCase() !== DEFAULT_PARTYKIT_HOST ? host : "";
  }
  if (host) return host;
  return environment === "production" ? DEFAULT_PARTYKIT_HOST : "localhost:1999";
}
