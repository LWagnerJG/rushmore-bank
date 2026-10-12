/**
 * Documents why /api/judge must not 308 cross-origin: fetch strips
 * Authorization when the redirect target is a different origin.
 */
import http from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve, reject) =>
          s.close((err) => (err ? reject(err) : resolve())),
        ),
    ),
  );
});

function listen(server: http.Server): Promise<number> {
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo | null;
      if (!addr) reject(new Error("no address"));
      else resolve(addr.port);
    });
    server.on("error", reject);
  });
}

describe("fetch redirect Authorization", () => {
  it("strips Authorization on a cross-origin 308 (PartyServer → Vercel → CF)", async () => {
    const echo = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          authorization: req.headers.authorization ?? null,
          "x-quarry-judge": req.headers["x-quarry-judge"] ?? null,
        }),
      );
    });
    const echoPort = await listen(echo);

    const bounce = http.createServer((_req, res) => {
      res.writeHead(308, {
        Location: `http://127.0.0.1:${echoPort}/api/judge`,
      });
      res.end();
    });
    const bouncePort = await listen(bounce);

    const res = await fetch(`http://127.0.0.1:${bouncePort}/api/judge`, {
      method: "POST",
      headers: {
        Authorization: "Bearer judge-secret",
        "X-Quarry-Judge": "partyserver",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authorization: null,
      "x-quarry-judge": "partyserver",
    });
  });

  it("keeps Authorization on a same-origin 308", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/from") {
        res.writeHead(308, { Location: `http://127.0.0.1:${port}/to` });
        return res.end();
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ authorization: req.headers.authorization ?? null }),
      );
    });
    const port = await listen(server);

    const res = await fetch(`http://127.0.0.1:${port}/from`, {
      headers: { Authorization: "Bearer keep-me" },
    });
    expect(await res.json()).toEqual({ authorization: "Bearer keep-me" });
  });
});
