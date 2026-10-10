export type ShareInviteResult = "shared" | "copied" | "cancelled" | "failed";

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "NotAllowedError";
}

/**
 * Prefer navigator.share; fall back to clipboard copy.
 * User-dismissed share sheets are cancelled (not copied).
 */
export async function shareInvite(opts: {
  url: string;
  code: string;
  title?: string;
  share?: (data: ShareData) => Promise<void>;
  copy?: (text: string) => Promise<void>;
}): Promise<ShareInviteResult> {
  const title = opts.title ?? "Beans";
  const share =
    opts.share ??
    (typeof navigator !== "undefined" && navigator.share
      ? navigator.share.bind(navigator)
      : undefined);
  const copy =
    opts.copy ??
    (typeof navigator !== "undefined" && navigator.clipboard?.writeText
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : undefined);

  if (share) {
    try {
      await share({
        title,
        url: opts.url,
        text: `Join Beans: ${opts.code}`,
      });
      return "shared";
    } catch (err) {
      if (isAbortError(err)) return "cancelled";
      // Fall through to copy on unexpected share failures.
    }
  }

  if (!copy) return "failed";
  try {
    await copy(opts.url);
    return "copied";
  } catch {
    return "failed";
  }
}
