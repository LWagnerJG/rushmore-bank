/**
 * Single source of truth for die faces + pip paint.
 *
 * Invariants (hard):
 * - A die face is an integer in 1..6, or blank (null).
 * - Pip count for a face always equals that face value (1→1 … 6→6).
 * - Renderers MUST replace pip children from one validated face — never append.
 * - Settled tray faces come only from server authoritative d1/d2 for the rollId.
 * - Scramble faces go through the same validator before paint.
 */
import { DIE_PIPS } from "./dice-geometry";
import type { DicePresentPhase } from "./dice-present";
import { scrambleFaceAt } from "./dice-scramble";

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

/** CSS class for every pip circle (React + any DOM path). */
export const DIE_PIP_CLASS = "bean-pip-die-pip";

/**
 * Clamp / validate any raw value to a legal die face.
 * Non-integers, out-of-range, NaN → null (blank die — never invent pips).
 */
export function normalizeDieFace(raw: unknown): DieFace | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw)) return null;
  if (raw < 1 || raw > 6) return null;
  return raw as DieFace;
}

/** Pip slot indices (0–8 grid) for one validated face. Length always === face. */
export function pipsForDieFace(face: DieFace | null): readonly number[] {
  if (face == null) return [];
  const pips = DIE_PIPS[face];
  if (!pips || pips.length !== face) {
    // Defense: never return a mismatched table row.
    return [];
  }
  return pips;
}

/** Pip count a renderer may paint for this face (0 when blank). */
export function diePipCount(face: DieFace | null): number {
  return pipsForDieFace(face).length;
}

/** Pure paint model for one die — what the UI is allowed to show. */
export type DiePaintModel = {
  face: DieFace | null;
  pipCount: number;
  pipSlots: readonly number[];
};

export function diePaintModel(rawFace: unknown): DiePaintModel {
  const face = normalizeDieFace(rawFace);
  const pipSlots = pipsForDieFace(face);
  return { face, pipCount: pipSlots.length, pipSlots };
}

/**
 * Replace (never append) all pip nodes under a die SVG with one validated face.
 * Clears every `.bean-pip-die-pip` first — scramble leftovers cannot stack.
 */
export function replaceDieFacePips(
  svg: ParentNode | null | undefined,
  rawFace: unknown,
): DiePaintModel {
  const model = diePaintModel(rawFace);
  if (!svg) return model;

  svg.querySelectorAll(`.${DIE_PIP_CLASS}`).forEach((n) => n.remove());

  if (model.face == null) return model;

  // Prefer Element.append when available (jsdom / browser).
  const el = svg as unknown as {
    ownerDocument?: Document;
    appendChild?: (n: Node) => void;
  };
  const doc = el.ownerDocument;
  if (!doc || typeof el.appendChild !== "function") return model;

  const ns = "http://www.w3.org/2000/svg";
  for (const pip of model.pipSlots) {
    const col = pip % 3;
    const row = Math.floor(pip / 3);
    const c = doc.createElementNS(ns, "circle");
    c.setAttribute("class", DIE_PIP_CLASS);
    c.setAttribute("cx", String(22 + col * 18));
    c.setAttribute("cy", String(22 + row * 18));
    c.setAttribute("r", "7");
    c.setAttribute("data-pip-slot", String(pip));
    el.appendChild(c);
  }
  return model;
}

export type TrayPaintModel = {
  rollId: string | null;
  /** Authoritative settled faces for this rollId (null while tumbling / idle blank). */
  authD1: DieFace | null;
  authD2: DieFace | null;
  /** What each die paints this frame (scramble or auth — always normalized). */
  paintD1: DieFace | null;
  paintD2: DieFace | null;
  pipCount1: number;
  pipCount2: number;
  /** Shown total only when both paint faces are settled auth for this rollId. */
  total: number | null;
  scrambling: boolean;
};

/**
 * Single tray paint decision: settled faces only from phase auth d1/d2;
 * scramble faces must already be normalized 1–6 (or null).
 */
export function resolveTrayPaint(
  phase: DicePresentPhase,
  scramble: { d1: unknown; d2: unknown } | null,
): TrayPaintModel {
  if (phase.kind === "idle") {
    const d1 = normalizeDieFace(phase.d1);
    const d2 = normalizeDieFace(phase.d2);
    return {
      rollId: null,
      authD1: d1,
      authD2: d2,
      paintD1: d1,
      paintD2: d2,
      pipCount1: diePipCount(d1),
      pipCount2: diePipCount(d2),
      total: d1 != null && d2 != null ? d1 + d2 : null,
      scrambling: false,
    };
  }

  if (phase.kind === "tumbling") {
    const d1 = normalizeDieFace(scramble?.d1);
    const d2 = normalizeDieFace(scramble?.d2);
    return {
      rollId: phase.rollId,
      authD1: null,
      authD2: null,
      paintD1: d1,
      paintD2: d2,
      pipCount1: diePipCount(d1),
      pipCount2: diePipCount(d2),
      total: null,
      scrambling: true,
    };
  }

  // settled — server authoritative faces only for this rollId
  const d1 = normalizeDieFace(phase.d1);
  const d2 = normalizeDieFace(phase.d2);
  return {
    rollId: phase.rollId,
    authD1: d1,
    authD2: d2,
    paintD1: d1,
    paintD2: d2,
    pipCount1: diePipCount(d1),
    pipCount2: diePipCount(d2),
    total: d1 != null && d2 != null ? d1 + d2 : null,
    scrambling: false,
  };
}

/** Next scramble pair for a tick — always validated 1–6. */
export function scramblePaintPair(
  seed: number,
  tick: number,
): { d1: DieFace; d2: DieFace } {
  const d1 = normalizeDieFace(scrambleFaceAt(seed, 0, tick));
  const d2 = normalizeDieFace(scrambleFaceAt(seed, 1, tick));
  // scrambleFaceAt is contractually 1–6; fall back to 1 if somehow not.
  return { d1: d1 ?? 1, d2: d2 ?? 1 };
}

/** Assert a painted die never shows an illegal pip count (for tests / CI). */
export function assertLegalDiePaint(model: DiePaintModel): void {
  if (model.face == null) {
    if (model.pipCount !== 0) {
      throw new Error(`blank die painted ${model.pipCount} pips`);
    }
    return;
  }
  if (model.pipCount < 1 || model.pipCount > 6) {
    throw new Error(`die face ${model.face} painted ${model.pipCount} pips`);
  }
  if (model.pipCount !== model.face) {
    throw new Error(
      `die face ${model.face} painted ${model.pipCount} pips (must equal face)`,
    );
  }
}

export function assertLegalTrayPaint(tray: TrayPaintModel): void {
  assertLegalDiePaint({
    face: tray.paintD1,
    pipCount: tray.pipCount1,
    pipSlots: pipsForDieFace(tray.paintD1),
  });
  assertLegalDiePaint({
    face: tray.paintD2,
    pipCount: tray.pipCount2,
    pipSlots: pipsForDieFace(tray.paintD2),
  });
  if (tray.total != null) {
    if (tray.authD1 == null || tray.authD2 == null) {
      throw new Error("total set without authoritative faces");
    }
    if (tray.total !== tray.authD1 + tray.authD2) {
      throw new Error(
        `total ${tray.total} !== ${tray.authD1}+${tray.authD2}`,
      );
    }
    if (tray.paintD1 !== tray.authD1 || tray.paintD2 !== tray.authD2) {
      throw new Error("settled paint faces drifted from auth d1/d2");
    }
  }
}
