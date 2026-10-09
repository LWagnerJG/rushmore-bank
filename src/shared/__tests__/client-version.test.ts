import { describe, expect, it } from "vitest";
import {
  detectStaleClient,
  isLegacyPartyHost,
  normalizeHost,
  normalizeSha,
  staleReloadMessage,
} from "../client-version";

describe("client version helpers", () => {
  it("normalizes sha / host", () => {
    expect(normalizeSha("ABCDEF12zzzz")).toBe("abcdef12");
    expect(normalizeHost("https://Beans-Party.example.workers.dev/room")).toBe(
      "beans-party.example.workers.dev",
    );
  });

  it("flags legacy PartyKit hosts", () => {
    expect(isLegacyPartyHost("mygame.username.partykit.dev")).toBe(true);
    expect(isLegacyPartyHost("beans-party.beans-lwagner.workers.dev")).toBe(
      false,
    );
    expect(isLegacyPartyHost("beans-party.YOUR_SUBDOMAIN.workers.dev")).toBe(
      true,
    );
  });

  it("detects build SHA mismatch", () => {
    const result = detectStaleClient({
      clientSha: "aaa11111",
      clientPartyHost: "beans-party.beans-lwagner.workers.dev",
      server: {
        sha: "bbb22222",
        partyHost: "beans-party.beans-lwagner.workers.dev",
        generatedAt: new Date().toISOString(),
      },
    });
    expect(result).toEqual({ stale: true, reason: "build" });
    expect(staleReloadMessage(result.reason)).toMatch(/newer Beans build/i);
  });

  it("detects party host drift and legacy hosts", () => {
    expect(
      detectStaleClient({
        clientSha: "aaa11111",
        clientPartyHost: "old.partykit.dev",
        server: {
          sha: "aaa11111",
          partyHost: "beans-party.beans-lwagner.workers.dev",
          generatedAt: new Date().toISOString(),
        },
      }).reason,
    ).toBe("party-host");

    expect(
      detectStaleClient({
        clientSha: "aaa11111",
        clientPartyHost: "stale.example.workers.dev",
        server: {
          sha: "aaa11111",
          partyHost: "beans-party.beans-lwagner.workers.dev",
          generatedAt: new Date().toISOString(),
        },
      }).reason,
    ).toBe("party-host");
  });

  it("stays quiet when sha/host match (including local)", () => {
    expect(
      detectStaleClient({
        clientSha: "local",
        clientPartyHost: "127.0.0.1:8787",
        server: {
          sha: "local",
          partyHost: "127.0.0.1:8787",
          generatedAt: new Date().toISOString(),
        },
      }).stale,
    ).toBe(false);

    expect(
      detectStaleClient({
        clientSha: "abcdef12",
        clientPartyHost: "beans-party.beans-lwagner.workers.dev",
        server: {
          sha: "abcdef12ffff",
          partyHost: "beans-party.beans-lwagner.workers.dev",
          generatedAt: new Date().toISOString(),
        },
      }).stale,
    ).toBe(false);
  });
});
