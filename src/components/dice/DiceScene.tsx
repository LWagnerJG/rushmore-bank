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

type DieKit = {
  mesh: import("three").Mesh;
  materials: import("three").MeshStandardMaterial[];
  textures: import("three").CanvasTexture[];
  geometry: import("three").BoxGeometry;
  edges: import("three").LineSegments;
  edgesGeo: import("three").EdgesGeometry;
  edgesMat: import("three").LineBasicMaterial;
};

function makeDie(
  THREE: typeof import("three"),
  faceColor: string,
  edgeColor: number,
): DieKit {
  const geometry = new THREE.BoxGeometry(1.05, 1.05, 1.05);
  const materials: import("three").MeshStandardMaterial[] = [];
  const textures: import("three").CanvasTexture[] = [];
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z
  const faceNums = [3, 4, 5, 2, 1, 6];
  for (const n of faceNums) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    drawPipFace(ctx, n, 256, faceColor);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    textures.push(tex);
    materials.push(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.42,
        metalness: 0.02,
      }),
    );
  }
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edgesGeo = new THREE.EdgesGeometry(geometry);
  const edgesMat = new THREE.LineBasicMaterial({
    color: edgeColor,
    transparent: true,
    opacity: 0.35,
  });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  mesh.add(edges);

  return { mesh, materials, textures, geometry, edges, edgesGeo, edgesMat };
}

function disposeDie(kit: DieKit) {
  for (const t of kit.textures) t.dispose();
  for (const m of kit.materials) m.dispose();
  kit.edgesMat.dispose();
  kit.edgesGeo.dispose();
  kit.geometry.dispose();
}

function playClackTone(
  audioRef: { current: AudioContext | null },
  seed: number,
  slot: number,
) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = audioRef.current ?? new Ctx();
    audioRef.current = ctx;
    if (ctx.state === "suspended") void ctx.resume();
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
    /* ignore audio failures */
  }
}

/**
 * Real 3D dice synced to server timestamps + seed.
 * Scene mounts once; mute/host flags are refs (never rebuild WebGL on toggle).
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
  const mutedRef = useRef(false);
  const isHostRef = useRef(isHost);
  const broadcastRef = useRef(broadcast);
  const [muted, setMuted] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  // Keep flags out of the Three.js effect deps so mute never remounts the scene.
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);
  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast]);

  useEffect(() => {
    if (!mountRef.current || reducedMotion || webglFailed) return;

    const mountEl = mountRef.current;
    let dead = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let lastRollId: string | null = null;
    let lastClackSlot = -1;
    let current: PublicDiceBroadcast | null = broadcastRef.current;
    let dieA: DieKit | null = null;
    let dieB: DieKit | null = null;
    let ground: import("three").Mesh | null = null;

    const applyFaces = (d1: number, d2: number) => {
      if (!dieA || !dieB) return;
      const r1 = faceRotation(d1);
      const r2 = faceRotation(d2);
      dieA.mesh.rotation.set(r1[0], r1[1], r1[2]);
      dieB.mesh.rotation.set(r2[0], r2[1], r2[2]);
      dieA.mesh.position.set(-1.15, 0.55, 0);
      dieB.mesh.position.set(1.15, 0.55, 0);
    };

    const setDice = (b: PublicDiceBroadcast) => {
      if (!dieA || !dieB) {
        current = b;
        return;
      }
      // Same roll + same reveal state → update payload only (no restart).
      if (lastRollId === b.rollId && current?.revealed === b.revealed) {
        current = b;
        return;
      }
      const isNew = lastRollId !== b.rollId;
      lastRollId = b.rollId;
      current = b;
      if (isNew && !b.revealed) {
        lastClackSlot = -1;
        dieA.mesh.position.set(-1.15, 2.0, 0);
        dieB.mesh.position.set(1.15, 2.25, 0);
      }
      if (b.revealed && b.d1 != null && b.d2 != null) {
        const now = Date.now();
        if (now >= b.animSettleAt || reducedMotion) {
          applyFaces(b.d1, b.d2);
        }
      }
    };

    void (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        if (!dead) setWebglFailed(true);
        return;
      }
      if (dead || !mountRef.current) return;

      const el = mountEl;
      const width = el.clientWidth || 320;
      const height = 240;

      scene = new THREE.Scene();
      scene.background = new THREE.Color("#E8F5EF");

      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 3.4, 6.4);
      camera.lookAt(0, 0.45, 0);

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
      } catch {
        if (!dead) setWebglFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Stable mount: replace children without tearing React's ref node.
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(renderer.domElement);

      const hemi = new THREE.HemisphereLight(0xffffff, 0xa7d7c2, 1.05);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xfff2d8, 0.95);
      dir.position.set(4, 9, 3);
      dir.castShadow = true;
      scene.add(dir);

      const groundGeo = new THREE.CircleGeometry(4.2, 48);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0xa7d7c2,
        roughness: 0.92,
      });
      ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      dieA = makeDie(THREE, "#FFE8DF", 0xe76f4e);
      dieB = makeDie(THREE, "#FFF4D6", 0xf4c95b);
      dieA.mesh.position.set(-1.15, 0.55, 0);
      dieB.mesh.position.set(1.15, 0.55, 0);
      scene.add(dieA.mesh, dieB.mesh);

      const onResize = () => {
        if (!renderer || !mountRef.current || dead) return;
        const w = mountRef.current.clientWidth || 320;
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
        renderer.setSize(w, height);
      };
      window.addEventListener("resize", onResize);

      const tick = () => {
        if (dead || !renderer || !scene || !dieA || !dieB) return;
        const b = current;
        if (b) {
          const now = Date.now();
          const t = animProgress(now, b.animStartedAt, b.animSettleAt);
          if (!b.revealed && t < 1) {
            const a = tumblePose(t, b.animSeed, 0);
            const c = tumblePose(t, b.animSeed, 1);
            dieA.mesh.rotation.set(a.rx, a.ry, a.rz);
            dieB.mesh.rotation.set(c.rx, c.ry, c.rz);
            dieA.mesh.position.set(a.x, a.y, 0);
            dieB.mesh.position.set(c.x, c.y, 0);
            if (
              t > 0.08 &&
              t < 0.88 &&
              isHostRef.current &&
              !mutedRef.current
            ) {
              const slot = Math.floor(t * 10);
              if (
                slot !== lastClackSlot &&
                (b.animSeed + slot * 17) % 4 === 0
              ) {
                lastClackSlot = slot;
                playClackTone(audioRef, b.animSeed, slot);
              }
            }
          } else if (b.revealed && b.d1 != null && b.d2 != null) {
            applyFaces(b.d1, b.d2);
          } else if (t >= 1 && !b.revealed) {
            const idleA = tumblePose(0.94, b.animSeed, 0);
            const idleB = tumblePose(0.94, b.animSeed, 1);
            dieA.mesh.rotation.set(idleA.rx, idleA.ry, idleA.rz);
            dieB.mesh.rotation.set(idleB.rx, idleB.ry, idleB.rz);
            dieA.mesh.position.set(idleA.x, idleA.y, 0);
            dieB.mesh.position.set(idleB.x, idleB.y, 0);
          }
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      if (current) setDice(current);

      if (dead || !mountRef.current) {
        // Effect cleaned up while three.js was loading — drop everything.
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
        if (dieA) disposeDie(dieA);
        if (dieB) disposeDie(dieB);
        if (ground) {
          ground.geometry.dispose();
          (ground.material as import("three").Material).dispose();
        }
        renderer.dispose();
        renderer.forceContextLoss?.();
        if (renderer.domElement.parentNode === el) {
          el.removeChild(renderer.domElement);
        }
        return;
      }

      // Stash updater on the mount node for the broadcast effect.
      (
        el as HTMLDivElement & {
          __setDice?: (b: PublicDiceBroadcast) => void;
        }
      ).__setDice = setDice;

      (
        el as HTMLDivElement & {
          __disposeDice?: () => void;
        }
      ).__disposeDice = () => {
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
        (
          el as HTMLDivElement & {
            __setDice?: (b: PublicDiceBroadcast) => void;
          }
        ).__setDice = undefined;
        if (dieA) disposeDie(dieA);
        if (dieB) disposeDie(dieB);
        if (ground) {
          ground.geometry.dispose();
          (ground.material as import("three").Material).dispose();
        }
        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss?.();
          if (renderer.domElement.parentNode === el) {
            el.removeChild(renderer.domElement);
          }
        }
        scene = null;
        renderer = null;
        dieA = null;
        dieB = null;
        ground = null;
      };
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      const el = mountEl as HTMLDivElement & {
        __disposeDice?: () => void;
      };
      el.__disposeDice?.();
      el.__disposeDice = undefined;
    };
  }, [reducedMotion, webglFailed]);

  // Push roll updates without remounting the scene.
  useEffect(() => {
    if (!broadcast || !mountRef.current) return;
    const el = mountRef.current as HTMLDivElement & {
      __setDice?: (b: PublicDiceBroadcast) => void;
    };
    el.__setDice?.(broadcast);
  }, [broadcast]);

  if (reducedMotion || webglFailed) {
    return (
      <div className="panel relative flex h-[240px] flex-col items-center justify-center gap-2">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">
          {webglFailed ? "3D unavailable" : "Reduced motion"}
        </p>
        {broadcast?.revealed &&
        broadcast.d1 != null &&
        broadcast.d2 != null ? (
          <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold">
            {broadcast.d1} · {broadcast.d2}
          </p>
        ) : (
          <p className="text-sm font-semibold text-[var(--muted)]">
            {broadcast ? "Rolling…" : "Waiting for a roll…"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mountRef}
        className="overflow-hidden rounded-[1.1rem] border-[1.5px] border-[rgba(35,72,62,0.1)] bg-[#E8F5EF]"
        style={{ height: 240 }}
      />
      {!broadcast && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-[var(--muted)]">
          Waiting for a roll…
        </p>
      )}
      <button
        type="button"
        className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide shadow-sm"
        aria-pressed={!muted}
        aria-label={muted ? "Unmute dice sound" : "Mute dice sound"}
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
      >
        {muted ? "Sound off" : "Sound"}
      </button>
    </div>
  );
}
