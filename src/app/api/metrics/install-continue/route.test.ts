import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/metrics/install-continue", () => {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});

  afterEach(() => {
    spy.mockClear();
  });

  it("logs a normalized room + count", async () => {
    const res = await POST(
      new Request("http://localhost/api/metrics/install-continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: "ab-cd", count: 3 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledWith("[beans] continue-in-browser", {
      room: "ABCD",
      count: 3,
    });
  });
});
