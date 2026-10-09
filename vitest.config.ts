import { defineConfig, type Plugin } from "vitest/config";
import path from "path";

const cloudflareWorkersStub = path.resolve(
  __dirname,
  "./test/mocks/cloudflare-workers.ts",
);

/** Vite aliases don't rewrite `cloudflare:` protocol imports — resolve manually. */
function stubCloudflareWorkers(): Plugin {
  return {
    name: "stub-cloudflare-workers",
    enforce: "pre",
    resolveId(id) {
      if (id === "cloudflare:workers") return cloudflareWorkersStub;
    },
  };
}

export default defineConfig({
  plugins: [stubCloudflareWorkers()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Bundle partyserver so our cloudflare:workers stub applies (not Node ESM).
    server: {
      deps: {
        inline: ["partyserver"],
      },
    },
  },
  ssr: {
    noExternal: ["partyserver"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
