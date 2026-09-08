/** Orthographic cube projection. SVG renders the same geometry without GPU layers. */
type Vector = [number, number, number];
type Matrix = [Vector, Vector, Vector];
const IDENTITY: Matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const FACES: Array<{ value: number; normal: Vector; u: Vector; v: Vector }> = [
  { value: 1, normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { value: 2, normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { value: 3, normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { value: 4, normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { value: 5, normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { value: 6, normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
export const DIE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
function apply(matrix: Matrix, vector: Vector): Vector {
  return matrix.map((row) =>
    row.reduce((sum, value, i) => sum + value * vector[i]!, 0),
  ) as Vector;
}
function multiply(a: Matrix, b: Matrix): Matrix {
  return a.map((row) =>
    [0, 1, 2].map((column) =>
      row.reduce((sum, value, i) => sum + value * b[i]![column]!, 0),
    ),
  ) as Matrix;
}
function rotation(x: number, y: number, z: number): Matrix {
  const cx = Math.cos(x),
    sx = Math.sin(x),
    cy = Math.cos(y),
    sy = Math.sin(y),
    cz = Math.cos(z),
    sz = Math.sin(z);
  return multiply(
    multiply(
      [
        [1, 0, 0],
        [0, cx, -sx],
        [0, sx, cx],
      ],
      [
        [cy, 0, sy],
        [0, 1, 0],
        [-sy, 0, cy],
      ],
    ),
    [
      [cz, -sz, 0],
      [sz, cz, 0],
      [0, 0, 1],
    ],
  );
}
/** Element-wise blend — good enough for short settle snaps. */
function lerpMatrix(a: Matrix, b: Matrix, t: number): Matrix {
  const u = Math.min(1, Math.max(0, t));
  return a.map((row, i) =>
    row.map((value, j) => value * (1 - u) + b[i]![j]! * u),
  ) as Matrix;
}
const REST: Matrix[] = [
  IDENTITY,
  rotation(-Math.PI / 2, 0, 0),
  rotation(0, -Math.PI / 2, 0),
  rotation(0, Math.PI / 2, 0),
  rotation(Math.PI / 2, 0, 0),
  rotation(0, Math.PI, 0),
];
function hull(points: number[][]): number[][] {
  const sorted = [...points].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const half = (input: number[][]) => {
    const out: number[][] = [];
    for (const point of input) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0
      )
        out.pop();
      out.push(point);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export interface DieProjection {
  front: number;
  outline: string;
  faces: Array<{
    value: number;
    visible: boolean;
    transform: string;
    shade: number;
  }>;
}

export function projectDie(opts: {
  face: number;
  index: 0 | 1;
  tumble?: { rx: number; ry: number; rz: number; x: number; y: number };
  /** 0 = full tumble, 1 = rest pose for `face`. */
  settle?: number;
}): DieProjection {
  const tumble = opts.tumble;
  const rest = multiply(
    rotation(-0.24, -0.3, opts.index ? 0.09 : -0.09),
    REST[opts.face - 1] ?? IDENTITY,
  );
  const settle = tumble ? Math.min(1, Math.max(0, opts.settle ?? 0)) : 1;

  let matrix: Matrix;
  let dx = 0;
  let dy = 0;
  if (tumble && settle < 1) {
    const tumbleMat = rotation(tumble.rx, tumble.ry, tumble.rz);
    matrix = settle <= 0 ? tumbleMat : lerpMatrix(tumbleMat, rest, settle);
    const slide = 1 - settle;
    dx = Math.max(-12, Math.min(12, (tumble.x - (opts.index ? 1.1 : -1.1)) * 18)) * slide;
    dy = Math.max(-25, Math.min(5, -(tumble.y - 0.55) * 18)) * slide;
  } else {
    matrix = rest;
  }

  const projected = FACES.map((face) => {
    const normal = apply(matrix, face.normal);
    const u = apply(matrix, face.u);
    const v = apply(matrix, face.v);
    return {
      value: face.value,
      visible: normal[2] > 0.0001,
      depth: normal[2],
      transform: `matrix(${u[0]} ${u[1]} ${v[0]} ${v[1]} ${normal[0]! * 32 + dx} ${normal[1]! * 32 + dy})`,
      shade: Math.max(
        0,
        Math.min(
          0.25,
          0.16 - normal[2]! * 0.1 + normal[1]! * 0.1 - normal[0]! * 0.025,
        ),
      ),
    };
  });
  const corners: number[][] = [];
  for (const x of [-32, 32])
    for (const y of [-32, 32])
      for (const z of [-32, 32]) {
        const point = apply(matrix, [x, y, z]);
        corners.push([point[0]! + dx, point[1]! + dy]);
      }
  return {
    front: [...projected].sort((a, b) => b.depth - a.depth)[0]!.value,
    outline: hull(corners)
      .map((point) => point.join(","))
      .join(" "),
    faces: projected
      .sort((a, b) => a.depth - b.depth)
      .map(({ value, visible, transform, shade }) => ({
        value,
        visible,
        transform,
        shade,
      })),
  };
}
