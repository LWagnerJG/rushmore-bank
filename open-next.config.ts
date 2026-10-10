import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Minimal OpenNext Cloudflare config for Beans.
 * SSR + Route Handlers (/api/judge, /api/version, …) work without R2/ISR cache.
 * Add R2 incremental cache later if SSG/ISR becomes important.
 */
export default defineCloudflareConfig();
