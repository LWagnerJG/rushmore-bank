import { buildWebManifest } from "@/shared/web-manifest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /manifest.webmanifest?room=ABCD|create=1 — scoped start_url when present. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const body = buildWebManifest(url.searchParams.get("room"), {
    create: url.searchParams.get("create") === "1",
  });
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
