"use client";

import { useEffect, useRef, useState } from "react";
import {
  collectDiagSnapshot,
  isStartButtonCutOff,
  type DiagSnapshot,
} from "@/shared/diag-measure";

function fmtRect(
  r: { x: number; y: number; width: number; height: number; bottom: number } | null,
): string {
  if (!r) return "(not found)";
  return `x:${r.x.toFixed(0)} y:${r.y.toFixed(0)} w:${r.width.toFixed(0)} h:${r.height.toFixed(0)} bot:${r.bottom.toFixed(0)}`;
}

function readBuildSha(): string {
  return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "local";
}

export function DiagPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<DiagSnapshot | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () =>
      setData(
        collectDiagSnapshot({
          win: window,
          doc: document,
          buildSha: readBuildSha(),
        }),
      );
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!data) return null;

  const cutOff = isStartButtonCutOff(data);

  const rows: [string, string][] = [
    ["SHA", data.buildSha],
    ["standalone", String(data.standalone)],
    ["display-mode:standalone", String(data.displayModeStandalone)],
    ["innerH", `${data.innerHeight}px`],
    ["innerW", `${data.innerWidth}px`],
    ["vvH", `${data.visualViewportH.toFixed(1)}px`],
    ["vvW", `${data.visualViewportW.toFixed(1)}px`],
    ["vvOffsetTop", `${data.visualViewportOffsetTop.toFixed(1)}px`],
    ["vvOffsetLeft", `${data.visualViewportOffsetLeft.toFixed(1)}px`],
    ["100dvh", `${data.dvhPx.toFixed(1)}px`],
    ["--app-h", data.appHVar],
    ["safe-top (probe)", data.safeTop],
    ["safe-right (probe)", data.safeRight],
    ["safe-bottom (probe)", data.safeBottom],
    ["safe-left (probe)", data.safeLeft],
    ["html bbox", fmtRect(data.htmlRect)],
    ["body bbox", fmtRect(data.bodyRect)],
    [".app-shell bbox", fmtRect(data.appShellRect)],
    [".phase-scroll bbox", fmtRect(data.phaseScrollRect)],
    ["Start btn bbox", fmtRect(data.startBtnRect)],
    [
      "Start bottom gap",
      data.startBottomGap == null
        ? "(n/a)"
        : `${data.startBottomGap.toFixed(1)}px${cutOff ? " CUTOFF" : ""}`,
    ],
    ["phase clientH", `${data.phaseScrollClientH}px`],
    ["phase scrollH", `${data.phaseScrollScrollH}px`],
    ["phase scrollTop", `${data.phaseScrollScrollTop.toFixed(0)}px`],
  ];

  return (
    <div className="diag-panel" role="dialog" aria-label="Beans diagnostics">
      <div className="diag-panel-inner">
        <div className="diag-panel-head">
          <strong>Beans Diagnostics</strong>
          <button type="button" className="diag-panel-close" onClick={onClose}>
            Close
          </button>
        </div>
        {cutOff && (
          <p className="diag-panel-warn" role="status">
            Start button sits below the visual viewport — scroll or check
            --app-h / safe-bottom.
          </p>
        )}
        <table className="diag-panel-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="diag-panel-foot">
          Updates every 1s. Open with ?diag=1 (works in the installed PWA) or 5
          quick logo taps. Safe-area via hidden env() padding probe.
        </p>
      </div>
    </div>
  );
}
