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

function makeDieMaterials(THREE: typeof import("three"), color: number) {
  const materials = [];
  const faceNums = [3, 4, 5, 2, 1, 6];
  for (const n of faceNums) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = n % 2 === 0 ? "#F5F0E7" : "#ffffff";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#23483E";
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 120);
    // Pip-style digits
    ctx.fillStyle = "#23483E";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 64, 68);
    const tex = new THREE.CanvasTexture(canvas);
    materials.push(
      new THREE.MeshStandardMaterial({
        map: tex,
        color,
        roughness: 0.45,
        metalness: 0.05,
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
      const height = 220;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#E8F5EF");

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 3.2, 6.2);
      camera.lookAt(0, 0.4, 0);

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch {
        setWebglFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      mountRef.current.innerHTML = "";
      mountRef.current.appendChild(renderer.domElement);

      const hemi = new THREE.HemisphereLight(0xffffff, 0xa7d7c2, 1.1);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xfff2d8, 0.85);
      dir.position.set(4, 8, 2);
      scene.add(dir);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(4, 48),
        new THREE.MeshStandardMaterial({
          color: 0xa7d7c2,
          roughness: 0.9,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      const geo = new THREE.BoxGeometry(1, 1, 1);
      const matsA = makeDieMaterials(THREE, 0xe76f4e);
      const matsB = makeDieMaterials(THREE, 0xf4c95b);
      const dieA = new THREE.Mesh(geo, matsA);
      const dieB = new THREE.Mesh(geo, matsB);
      dieA.position.set(-1.1, 0.55, 0);
      dieB.position.set(1.1, 0.55, 0);
      scene.add(dieA, dieB);

      const playClack = (seed: number, t: number) => {
        if (!isHost || muted) return;
        // Deterministic clack windows from seed — not Math.random
        const slot = Math.floor(t * 8);
        if ((seed + slot * 17) % 5 !== 0) return;
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
          o.frequency.value = 160 + (seed % 40);
          g.gain.value = 0.035;
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
          o.stop(ctx.currentTime + 0.11);
        } catch {
          /* ignore */
        }
      };

      const applyFaces = (d1: number, d2: number) => {
        const r1 = faceRotation(d1);
        const r2 = faceRotation(d2);
        dieA.rotation.set(r1[0], r1[1], r1[2]);
        dieB.rotation.set(r2[0], r2[1], r2[2]);
        dieA.position.set(-1.1, 0.55, 0);
        dieB.position.set(1.1, 0.55, 0);
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
            if (t > 0.12 && t < 0.85) playClack(current.animSeed, t);
          } else if (
            current.revealed &&
            current.d1 != null &&
            current.d2 != null
          ) {
            applyFaces(current.d1, current.d2);
          } else if (t >= 1 && !current.revealed) {
            // Waiting for server reveal — keep a gentle idle spin from seed
            const idle = tumblePose(0.92, current.animSeed, 0);
            dieA.rotation.set(idle.rx, idle.ry, idle.rz);
            dieB.rotation.set(
              tumblePose(0.92, current.animSeed, 1).rx,
              tumblePose(0.92, current.animSeed, 1).ry,
              tumblePose(0.92, current.animSeed, 1).rz,
            );
          }
        }
        renderer!.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      (mountRef.current as HTMLDivElement & {
        __setDice?: (b: PublicDiceBroadcast) => void;
      }).__setDice = (b) => {
        // Avoid replaying animation on unrelated state updates
        if (lastRollId.current === b.rollId && current?.revealed === b.revealed) {
          current = b;
          return;
        }
        const isNew = lastRollId.current !== b.rollId;
        lastRollId.current = b.rollId;
        current = b;
        if (isNew && !b.revealed) {
          dieA.position.set(-1.1, 1.8, 0);
          dieB.position.set(1.1, 2.1, 0);
        }
        if (b.revealed && b.d1 != null && b.d2 != null) {
          // Reconnect mid/post settle: show settled faces
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
    // Scene boot once per motion/host preference; rolls sync via second effect
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
        className="panel flex h-[220px] items-center justify-center text-sm text-[var(--muted)]"
      >
        Waiting for a roll…
      </div>
    );
  }

  if (reducedMotion || webglFailed) {
    return (
      <div className="panel relative flex h-[220px] flex-col items-center justify-center gap-2">
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
        style={{ height: 220 }}
      />
      <button
        type="button"
        className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold uppercase"
        onClick={() => setMuted((m) => !m)}
      >
        {muted ? "Sound off" : "Sound"}
      </button>
    </div>
  );
}
