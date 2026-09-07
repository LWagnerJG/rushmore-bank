"use client";

import { useEffect, useRef } from "react";
import type { DiceBroadcast } from "@/shared/types";

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
  // order: +x, -x, +y, -y, +z, -z → map to faces 3,4,2,5,1,6-ish
  // We'll use canvas textures labeled 1–6 on six materials in BoxGeometry order:
  // BoxGeometry materials: right, left, top, bottom, front, back
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
 * Real 3D dice: spin / bounce / settle to authoritative faces.
 * Reduced-motion: snap to final faces without animation.
 */
export function DiceScene({
  broadcast,
  reducedMotion,
  isHost,
}: {
  broadcast: DiceBroadcast | null;
  reducedMotion: boolean;
  isHost: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let dead = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;

    void (async () => {
      const THREE = await import("three");
      if (dead || !mountRef.current) return;

      const width = mountRef.current.clientWidth || 320;
      const height = 220;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#E8F5EF");

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 3.2, 6.2);
      camera.lookAt(0, 0.4, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      mountRef.current.innerHTML = "";
      mountRef.current.appendChild(renderer.domElement);

      const hemi = new THREE.HemisphereLight(0xffffff, 0xA7D7C2, 1.1);
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
      const dieA = new THREE.Mesh(geo, makeDieMaterials(THREE, 0xe76f4e));
      const dieB = new THREE.Mesh(geo, makeDieMaterials(THREE, 0xf4c95b));
      dieA.position.set(-1.1, 0.55, 0);
      dieB.position.set(1.1, 0.55, 0);
      scene.add(dieA, dieB);

      const playClack = () => {
        if (!isHost || reducedMotion) return;
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
          o.frequency.value = 180 + Math.random() * 40;
          g.gain.value = 0.04;
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
          o.stop(ctx.currentTime + 0.13);
        } catch {
          /* ignore */
        }
      };

      const applyFaces = (d1: number, d2: number) => {
        const r1 = faceRotation(d1);
        const r2 = faceRotation(d2);
        dieA.rotation.set(r1[0], r1[1], r1[2]);
        dieB.rotation.set(r2[0], r2[1], r2[2]);
        dieA.position.y = 0.55;
        dieB.position.y = 0.55;
      };

      let animating = false;
      let start = 0;
      let target: { d1: number; d2: number; seed: number } | null = null;
      const duration = 2000;

      const tick = (now: number) => {
        if (dead) return;
        if (animating && target) {
          const t = Math.min(1, (now - start) / duration);
          const ease = 1 - Math.pow(1 - t, 3);
          const spin = (1 - ease) * (10 + (target.seed % 7));
          const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 1.4;

          dieA.rotation.x += 0.21 * spin;
          dieA.rotation.y += 0.17 * spin;
          dieA.rotation.z += 0.13 * spin;
          dieB.rotation.x += 0.19 * spin;
          dieB.rotation.y += 0.23 * spin;
          dieB.rotation.z += 0.11 * spin;

          dieA.position.y = 0.55 + bounce;
          dieB.position.y = 0.55 + bounce * 0.9;
          dieA.position.x = -1.1 + Math.sin(t * 12) * 0.15 * (1 - t);
          dieB.position.x = 1.1 + Math.cos(t * 11) * 0.15 * (1 - t);

          if (t > 0.15 && t < 0.85 && Math.random() < 0.04) playClack();

          if (t >= 1) {
            animating = false;
            applyFaces(target.d1, target.d2);
            playClack();
          }
        }
        renderer!.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      // Watch broadcast via closure update on each effect re-run — handled below
      (mountRef.current as HTMLDivElement & { __setDice?: typeof applyAndSpin }).__setDice =
        applyAndSpin;

      function applyAndSpin(b: DiceBroadcast) {
        if (reducedMotion) {
          applyFaces(b.d1, b.d2);
          animating = false;
          return;
        }
        target = { d1: b.d1, d2: b.d2, seed: b.animSeed };
        start = performance.now();
        animating = true;
        dieA.position.set(-1.1, 1.8, 0);
        dieB.position.set(1.1, 2.1, 0);
      }

      if (broadcast) applyAndSpin(broadcast);
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
    // Re-init scene when broadcast identity changes heavily — separate effect syncs faces
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, isHost]);

  useEffect(() => {
    if (!broadcast || !mountRef.current) return;
    const el = mountRef.current as HTMLDivElement & {
      __setDice?: (b: DiceBroadcast) => void;
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

  if (reducedMotion) {
    return (
      <div className="panel flex h-[220px] flex-col items-center justify-center gap-2">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">
          Reduced motion
        </p>
        <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold">
          {broadcast.d1} · {broadcast.d2}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="overflow-hidden rounded-[1.1rem] border-[1.5px] border-[rgba(35,72,62,0.1)]"
      style={{ height: 220 }}
    />
  );
}
