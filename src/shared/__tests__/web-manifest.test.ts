import { describe, expect, it } from "vitest";
import {
  CREATE_START_URL,
  buildWebManifest,
  createManifestHref,
  roomManifestHref,
  roomStartUrl,
} from "../web-manifest";

describe("room-scoped web manifest", () => {
  it("uses a path-absolute start_url so it does not resolve against the manifest URL", () => {
    expect(roomStartUrl("ABCD")).toBe("/join/ABCD");
    expect(roomStartUrl("ab-cd")).toBe("/join/ABCD");
    expect(roomStartUrl("AB")).toBe("/");
    expect(roomStartUrl(null)).toBe("/");
    expect(roomManifestHref("ABCD")).toBe("/manifest.webmanifest?room=ABCD");
    expect(roomManifestHref("")).toBe("/manifest.webmanifest");
  });

  it("keeps a stable id so later launches stay the same app", () => {
    const home = buildWebManifest(null);
    const room = buildWebManifest("ABCD");
    expect(home.id).toBe(room.id);
    expect(home.start_url).toBe("/");
    expect(room.start_url).toBe("/join/ABCD");
    expect(room.scope).toBe("/");
    expect(room.display).toBe("standalone");
  });

  it("points create-install at /?create=1 without changing the app id", () => {
    const create = buildWebManifest(null, { create: true });
    expect(create.start_url).toBe(CREATE_START_URL);
    expect(create.id).toBe(buildWebManifest(null).id);
    expect(createManifestHref(true)).toBe("/manifest.webmanifest?create=1");
    expect(createManifestHref(false)).toBe("/manifest.webmanifest");
    expect(buildWebManifest("ABCD", { create: true }).start_url).toBe(
      "/join/ABCD",
    );
  });
});
