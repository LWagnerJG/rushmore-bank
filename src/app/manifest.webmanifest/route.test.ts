import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { buildWebManifest } from "@/shared/web-manifest";

describe("GET /manifest.webmanifest", () => {
  it("defaults start_url to / when no room is given", async () => {
    const res = await GET(new Request("http://localhost/manifest.webmanifest"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/manifest\+json/);
    expect(res.headers.get("Cache-Control")).toMatch(/must-revalidate/);
    const body = await res.json();
    expect(body).toEqual(buildWebManifest(null));
    expect(body.start_url).toBe("/");
    expect(body.id).toBe("/?icon=v3");
    expect(body.scope).toBe("/");
    expect(body.display).toBe("standalone");
  });

  it("puts a normalized room in start_url and keeps a stable id", async () => {
    const res = await GET(
      new Request("http://localhost/manifest.webmanifest?room=ab-cd"),
    );
    const body = await res.json();
    expect(body.start_url).toBe("/join/ABCD");
    expect(body.id).toBe("/?icon=v3");
    expect(body.scope).toBe("/");
  });

  it("points create=1 at /?create=1", async () => {
    const res = await GET(
      new Request("http://localhost/manifest.webmanifest?create=1"),
    );
    const body = await res.json();
    expect(body.start_url).toBe("/?create=1");
    expect(body.id).toBe("/?icon=v3");
  });

  it("ignores short or empty room codes", async () => {
    const short = await GET(
      new Request("http://localhost/manifest.webmanifest?room=AB"),
    );
    expect((await short.json()).start_url).toBe("/");
    const empty = await GET(
      new Request("http://localhost/manifest.webmanifest?room="),
    );
    expect((await empty.json()).start_url).toBe("/");
  });
});
