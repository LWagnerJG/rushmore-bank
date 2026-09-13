"use client";

import { useEffect, useRef, useState } from "react";

interface DiagData {
  buildSha: string;
  standalone: boolean;
  innerHeight: number;
  innerWidth: number;
  visualViewportH: number;
  visualViewportW: number;
  visualViewportOffset: number;
  dvhPx: number;
  appHVar: string;
  safeTop: string;
  safeRight: string;
  safeBottom: string;
  safeLeft: string;
  htmlRect: DOMRect | null;
  bodyRect: DOMRect | null;
  appShellRect: DOMRect | null;
  phaseScrollRect: DOMRect | null;
  phaseScrollClientH: number;
  phaseScrollScrollH: number;
  phaseScrollScrollTop: number;
}

function measure(): DiagData {
  const cs = getComputedStyle(document.documentElement);
  const dvhEl = document.createElement("div");
  dvhEl.style.cssText =
    "position:fixed;top:0;left:0;height:100dvh;width:0;pointer-events:none;visibility:hidden;";
  document.body.appendChild(dvhEl);
  const dvhPx = dvhEl.getBoundingClientRect().height;
  dvhEl.remove();

  const phaseScroll = document.querySelector(".room-phase-scroll");
  const appShell = document.querySelector(".app-shell");

  return {
    buildSha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "local",
    standalone:
      "standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    visualViewportH: window.visualViewport?.height ?? -1,
    visualViewportW: window.visualViewport?.width ?? -1,
    visualViewportOffset: window.visualViewport?.offsetTop ?? -1,
    dvhPx,
    appHVar: cs.getPropertyValue("--app-h").trim() || "(not set)",
    safeTop: cs.getPropertyValue("--sat").trim() ||
      cs.getPropertyValue("env(safe-area-inset-top)").trim() || "?",
    safeRight: cs.getPropertyValue("--sar").trim() || "?",
    safeBottom: cs.getPropertyValue("--sab").trim() ||
      cs.getPropertyValue("env(safe-area-inset-bottom)").trim() || "?",
    safeLeft: cs.getPropertyValue("--sal").trim() || "?",
    htmlRect: document.documentElement.getBoundingClientRect(),
    bodyRect: document.body.getBoundingClientRect(),
    appShellRect: appShell?.getBoundingClientRect() ?? null,
    phaseScrollRect: phaseScroll?.getBoundingClientRect() ?? null,
    phaseScrollClientH: (phaseScroll as HTMLElement | null)?.clientHeight ?? -1,
    phaseScrollScrollH: (phaseScroll as HTMLElement | null)?.scrollHeight ?? -1,
    phaseScrollScrollTop: (phaseScroll as HTMLElement | null)?.scrollTop ?? -1,
  };
}

function fmtRect(r: DOMRect | null): string {
  if (!r) return "(not found)";
  return `x:${r.x.toFixed(0)} y:${r.y.toFixed(0)} w:${r.width.toFixed(0)} h:${r.height.toFixed(0)}`;
}

export function DiagPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<DiagData | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setData(measure());
    intervalRef.current = setInterval(() => setData(measure()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!data) return null;

  const rows: [string, string][] = [
    ["SHA", data.buildSha],
    ["standalone", String(data.standalone)],
    ["innerH", `${data.innerHeight}px`],
    ["innerW", `${data.innerWidth}px`],
    ["vvH", `${data.visualViewportH.toFixed(1)}px`],
    ["vvW", `${data.visualViewportW.toFixed(1)}px`],
    ["vvOffset", `${data.visualViewportOffset.toFixed(1)}px`],
    ["100dvh", `${data.dvhPx.toFixed(1)}px`],
    ["--app-h", data.appHVar],
    ["safe-top", data.safeTop],
    ["safe-bottom", data.safeBottom],
    ["safe-left", data.safeLeft],
    ["safe-right", data.safeRight],
    ["html bbox", fmtRect(data.htmlRect)],
    ["body bbox", fmtRect(data.bodyRect)],
    [".app-shell bbox", fmtRect(data.appShellRect)],
    [".phase-scroll bbox", fmtRect(data.phaseScrollRect)],
    ["phase clientH", `${data.phaseScrollClientH}px`],
    ["phase scrollH", `${data.phaseScrollScrollH}px`],
    ["phase scrollTop", `${data.phaseScrollScrollTop.toFixed(0)}px`],
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        color: "#f5f0e7",
        fontFamily: "monospace",
        fontSize: 11,
        overflowY: "auto",
        padding: "env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)",
      }}
    >
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ fontSize: 14 }}>Beans Diagnostics</strong>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "1px solid #f5f0e7", color: "#f5f0e7", padding: "2px 10px", borderRadius: 4, cursor: "pointer" }}
          >
            ✕ Close
          </button>
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <td style={{ padding: "4px 8px 4px 0", color: "#a7d7c2", whiteSpace: "nowrap" }}>
                  {label}
                </td>
                <td style={{ padding: "4px 0", wordBreak: "break-all" }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 12, color: "#a7d7c2", fontSize: 10 }}>
          Updates every 1s. Trigger: ?diag=1 or 5 quick logo taps.
        </p>
      </div>
    </div>
  );
}
