export interface DiceFaces {
  d1: number;
  d2: number;
}

export type DiceOutcomeKind = "bust" | "double_pot" | "add_sum";

export interface DiceOutcome {
  kind: DiceOutcomeKind;
  potBefore: number;
  potAfter: number;
  delta: number;
  total: number;
  isDoubles: boolean;
  personalRollNumber: number;
  busted: boolean;
  note: string;
}

export function isValidFaces(d1: number, d2: number): boolean {
  return (
    Number.isInteger(d1) &&
    Number.isInteger(d2) &&
    d1 >= 1 &&
    d1 <= 6 &&
    d2 >= 1 &&
    d2 <= 6
  );
}

/**
 * Apply one personal 2d6 roll to a pot.
 *
 * Any total of 7 → bust (pot=0), including the first roll of a turn.
 * Doubles → double pot (no add faces). Else → +sum.
 */
export function applyDiceRoll(
  pot: number,
  faces: DiceFaces,
  personalRollNumber: number,
): DiceOutcome {
  const potBefore = Math.max(0, Math.floor(pot));
  const { d1, d2 } = faces;
  if (!isValidFaces(d1, d2)) {
    throw new Error("Invalid dice faces");
  }
  const total = d1 + d2;
  const isDoubles = d1 === d2;

  if (total === 7) {
    return {
      kind: "bust",
      potBefore,
      potAfter: 0,
      delta: -potBefore,
      total,
      isDoubles,
      personalRollNumber,
      busted: true,
      note: "BEAN BUSTER — pot wiped.",
    };
  }
  if (isDoubles) {
    const potAfter = potBefore * 2;
    return {
      kind: "double_pot",
      potBefore,
      potAfter,
      delta: potAfter - potBefore,
      total,
      isDoubles,
      personalRollNumber,
      busted: false,
      note: `Doubles → pot doubles to ${potAfter}`,
    };
  }
  const potAfter = potBefore + total;
  return {
    kind: "add_sum",
    potBefore,
    potAfter,
    delta: total,
    total,
    isDoubles,
    personalRollNumber,
    busted: false,
    note: `+${total}`,
  };
}

/** All 36 face pairs for synchronized animation lookup. */
export const ALL_FACE_PAIRS: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      out.push([a, b]);
    }
  }
  return out;
})();
