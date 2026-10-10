import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Never ship the on-screen Issue/N badge into screenshots or device QA.
  // Compile/runtime errors still surface via the error overlay.
  devIndicators: false,
  async headers() {
    return [
      {
        // HTML documents must revalidate so PWAs don't keep a dead shell.
        source: "/:path*",
        has: [{ type: "header", key: "accept", value: "(.*text/html.*)" }],
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/api/version",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
