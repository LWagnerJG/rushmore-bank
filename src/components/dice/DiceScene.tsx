"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { animProgress, tumblePose } from "@/shared/engine/dice-sync";

/** Map die face 1–6 to Euler rotations (radians) for a standard cube. */
function faceRotation(face: number): [number, number, number] {
  switch (face) {
    case 1:
      return [0, 0, 0];
    case 2:
      return [-Math.PI / 2, 0, 0];
    case 3:
      return [0, Math.PI / 2, 0];
    case 4:
      return [0, -Math.PI / 2, 0];
    case 5:
      return [Math.PI / 2, 0, 0];
    case 6:
      return [Math.PI, 0, 0];
    default:
      return [0, 0, 0];
  }
}

/** Classic pip layouts in a 3×3 grid (1 = pip present). */
const PIP_LAYOUTS: Record<number, number[][]> = {
  1: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ],
  2: [
    [1, 0, 0],
    [0, 0, 0],
    [0, 0, 1],
  ],
  3: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  4: [
    [1, 0, 1],
    [0, 0, 0],
    [1, 0, 1],
  ],
  5: [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ],
  6: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
};

function drawPipFace(
  ctx: CanvasRenderingContext2D,
  n: number,
  size: number,
  faceColor: string,
) {
  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, size, size);
  // Soft inset border
  ctx.strokeStyle = "rgba(35,72,62,0.28)";
  ctx.lineWidth = size * 0.045;
  ctx.strokeRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92);

  const layout = PIP_LAYOUTS[n] ?? PIP_LAYOUTS[1]!;
  const margin = size * 0.2;
  const cell = (size - margin * 2) / 2;
  const pipR = size * 0.085;
  ctx.fillStyle = "#23483E";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (!layout[r]![c]) continue;
      const x = margin + (c === 0 ? 0 : c === 1 ? cell : cell * 2);
      const y = margin + (r === 0 ? 0 : r === 1 ? cell : cell * 2);
      ctx.beginPath();
      ctx.arc(x, y, pipR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function makeDieMaterials(
  THREE: typeof import("three"),
  tint: number,
  faceColor: string,
) {
  const materials = [];
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const faceNums = [3, 4, 5, 2, 1, 6];
  for (const n of faceNums) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    drawPipFace(ctx, n, 256, faceColor);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    materials.push(
      new THREE.MeshStandardMaterial({
        map: tex,
        color: tint,
        roughness: 0.38,
        metalness: 0.04,
      }),
    );
  }
  return materials;
}

/**
 * Real 3D dice synced to server timestamps + seed.
 * Time-based poses (not frame deltas) so FPS / network delay stay consistent.
 */
export function DiceScene({
  broadcast,
  reducedMotion,
  isHost,
}: {
  broadcast: PublicDiceBroadcast | null;
  reducedMotion: boolean;
  isHost: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const lastRollId = useRef<string | null>(null);
  const lastClackSlot = useRef(-1);

  useEffect(() => {
    if (!mountRef.current || reducedMotion || webglFailed) return;
    let dead = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let current: PublicDiceBroadcast | null = null;

    void (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        setWebglFailed(true);
        return;
      }
      if (dead || !mountRef.current) return;

      const width = mountRef.current.clientWidth || 320;
      const height = 240;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#E8F5EF");

      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 3.4, 6.4);
      camera.lookAt(0, 0.45, 0);

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch {
        setWebglFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      mountRef.current.innerHTML = "";
      mountRef.current.appendChild(renderer.domElement);

      const hemi = new THREE.HemisphereLight(0xffffff, 0xa7d7c2, 1.05);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xfff2d8, 0.95);
      dir.position.set(4, 9, 3);
      dir.castShadow = true;
      scene.add(dir);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(4.2, 64),
        new THREE.MeshStandardMaterial({
          color: 0xa7d7c2,
          roughness: 0.92,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const geo = new THREE.BoxGeometry(1.05, 1.05, 1.05, 1, 1, 1);
      const matsA = makeDieMaterials(THREE, 0xffffff, "#FFE8DF");
      const matsB = makeDieMaterials(THREE, 0xffffff, "#FFF4D6");
      // Tint via emissive rim: coral / yellow edge feel with colored wire rim
      const rimA = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: 0xe76f4e,
          wireframe: true,
          transparent: true,
          opacity: 0.22,
        }),
      );
      const rimB = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: 0xf4c95b,
          wireframe: true,
          transparent: true,
          opacity: 0.22,
        }),
      );
      const dieA = new THREE.Mesh(geo, matsA);
      const dieB = new THREE.Mesh(geo, matsB);
      dieA.castShadow = true;
      dieB.castShadow = true;
      dieA.position.set(-1.15, 0.55, 0);
      dieB.position.set(1.15, 0.55, 0);
      rimA.scale.setScalar(1.02);
      rimB.scale.setScalar(1.02);
      dieA.add(rimA);
      dieB.add(rimB);
      scene.add(dieA, dieB);

      const playClack = (seed: number, t: number) => {
        if (!isHost || muted) return;
        const slot = Math.floor(t * 10);
        if (slot === lastClackSlot.current) return;
        if ((seed + slot * 17) % 4 !== 0) return;
        lastClackSlot.current = slot;
        try {
          const ctx =
            audioRef.current ??
            new (window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext)();
          audioRef.current = ctx;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = 140 + (seed % 50) + slot * 3;
          g.gain.value = 0.04;
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
          o.stop(ctx.currentTime + 0.09);
        } catch {
          /* ignore */
        }
      };

      const applyFaces = (d1: number, d2: number) => {
        const r1 = faceRotation(d1);
        const r2 = faceRotation(d2);
        dieA.rotation.set(r1[0], r1[1], r1[2]);
        dieB.rotation.set(r2[0], r2[1], r2[2]);
        dieA.position.set(-1.15, 0.55, 0);
        dieB.position.set(1.15, 0.55, 0);
      };

      const disposeMats = (mats: import("three").MeshStandardMaterial[]) => {
        for (const m of mats) {
          m.map?.dispose();
          m.dispose();
        }
      };

      const tick = () => {
        if (dead) return;
        if (current) {
          const now = Date.now();
          const t = animProgress(
            now,
            current.animStartedAt,
            current.animSettleAt,
          );
          if (!current.revealed && t < 1) {
            const a = tumblePose(t, current.animSeed, 0);
            const b = tumblePose(t, current.animSeed, 1);
            dieA.rotation.set(a.rx, a.ry, a.rz);
            dieB.rotation.set(b.rx, b.ry, b.rz);
            dieA.position.set(a.x, a.y, 0);
            dieB.position.set(b.x, b.y, 0);
            if (t > 0.08 && t < 0.88) playClack(current.animSeed, t);
          } else if (
            current.revealed &&
            current.d1 != null &&
            current.d2 != null
          ) {
            applyFaces(current.d1, current.d2);
          } else if (t >= 1 && !current.revealed) {
            // Waiting for server reveal — hold near-settle pose, never show faces
            const idleA = tumblePose(0.94, current.animSeed, 0);
            const idleB = tumblePose(0.94, current.animSeed, 1);
            dieA.rotation.set(idleA.rx, idleA.ry, idleA.rz);
            dieB.rotation.set(idleB.rx, idleB.ry, idleB.rz);
            dieA.position.set(idleA.x, idleA.y, 0);
            dieB.position.set(idleB.x, idleB.y, 0);
          }
        }
        renderer!.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      (mountRef.current as HTMLDivElement & {
        __setDice?: (b: PublicDiceBroadcast) => void;
      }).__setDice = (b) => {
        if (lastRollId.current === b.rollId && current?.revealed === b.revealed) {
          current = b;
          return;
        }
        const isNew = lastRollId.current !== b.rollId;
        lastRollId.current = b.rollId;
        current = b;
        if (isNew && !b.revealed) {
          lastClackSlot.current = -1;
          dieA.position.set(-1.15, 2.0, 0);
          dieB.position.set(1.15, 2.25, 0);
        }
        if (b.revealed && b.d1 != null && b.d2 != null) {
          const now = Date.now();
          if (now >= b.animSettleAt || reducedMotion) {
            applyFaces(b.d1, b.d2);
          }
        }
      };

      if (broadcast) {
        (
          mountRef.current as HTMLDivElement & {
            __setDice?: (b: PublicDiceBroadcast) => void;
          }
        ).__setDice?.(broadcast);
      }

      return () => {
        disposeMats(matsA as import("three").MeshStandardMaterial[]);
        disposeMats(matsB as import("three").MeshStandardMaterial[]);
        geo.dispose();
      };
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, isHost, muted, webglFailed]);

  useEffect(() => {
    if (!broadcast || !mountRef.current) return;
    const el = mountRef.current as HTMLDivElement & {
      __setDice?: (b: PublicDiceBroadcast) => void;
    };
    el.__setDice?.(broadcast);
  }, [broadcast]);

  if (!broadcast) {
    return (
      <div
        ref={mountRef}
        className="panel flex h-[240px] items-center justify-center text-sm text-[var(--muted)]"
      >
        Waiting for a roll…
      </div>
    );
  }

  if (reducedMotion || webglFailed) {
    return (
      <div className="panel relative flex h-[240px] flex-col items-center justify-center gap-2">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">
          {webglFailed ? "3D unavailable" : "Reduced motion"}
        </p>
        {broadcast.revealed && broadcast.d1 != null && broadcast.d2 != null ? (
          <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold">
            {broadcast.d1} · {broadcast.d2}
          </p>
        ) : (
          <p className="text-sm font-semibold text-[var(--muted)]">Rolling…</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mountRef}
        className="overflow-hidden rounded-[1.1rem] border-[1.5px] border-[rgba(35,72,62,0.1)]"
        style={{ height: 240 }}
      />
      <button
        type="button"
        className="absolute right-2 top-2 rounded-lg bg-white/85 px-2 py-1 text-[10px] font-bold uppercase"
        onClick={() => setMuted((m) => !m)}
      >
        {muted ? "Sound off" : "Sound"}
      </button>
    </div>
  );
}
