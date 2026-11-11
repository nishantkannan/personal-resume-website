"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Highlight } from "@/data/resume";
import { useTheme } from "@/lib/client-state";

const COLS = 30;
const ROWS = 18;
const CELL = 1;
const BOX = 0.84;
const RISE_SECONDS = 1.6;

/** Grid cells (col, row) where each result's peak stands, in highlight order. */
const PEAK_CELLS: [number, number][] = [
  [17, 8],
  [9, 6],
  [23, 12],
  [12, 12],
  [24, 4],
  [5, 11],
  [19, 15],
];

type Palette = { base: THREE.Color; high: THREE.Color; signal: THREE.Color; line: THREE.Color };

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    base: new THREE.Color(get("--terrain-base", "#b9c9ce")),
    high: new THREE.Color(get("--terrain-high", "#3e6f78")),
    signal: new THREE.Color(get("--signal", "#e3a81b")),
    line: new THREE.Color(get("--line", "#c3ccd1")),
  };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Smooth rolling ground plus a hill around every peak, so results sit on ridges. */
function buildTerrain(highlights: Highlight[]) {
  const peakIndex = new Map<string, number>();
  PEAK_CELLS.slice(0, highlights.length).forEach(([c, r], i) => peakIndex.set(`${c},${r}`, i));

  const cells: { x: number; z: number; h: number }[] = [];
  let maxH = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (peakIndex.has(`${c},${r}`)) continue;
      let h =
        0.35 +
        0.45 * (Math.sin(c * 0.33) * 0.5 + 0.5) * (Math.cos(r * 0.42 + c * 0.12) * 0.5 + 0.5);
      highlights.forEach((hl, i) => {
        const [pc, pr] = PEAK_CELLS[i];
        const d2 = (c - pc) ** 2 + (r - pr) ** 2;
        h += hl.weight * 3.6 * Math.exp(-d2 / (2 * 1.7 ** 2));
      });
      cells.push({ x: (c - COLS / 2) * CELL, z: (r - ROWS / 2) * CELL, h });
      maxH = Math.max(maxH, h);
    }
  }

  const peaks = highlights.map((hl, i) => {
    const [c, r] = PEAK_CELLS[i];
    return { x: (c - COLS / 2) * CELL, z: (r - ROWS / 2) * CELL, h: 1.4 + hl.weight * 5.2 };
  });

  return { cells, peaks, maxH };
}

type SceneProps = {
  highlights: Highlight[];
  active: number | null;
  onActive: (i: number | null) => void;
  onSelect: (i: number) => void;
  animate: boolean;
};

function Scene({ highlights, active, onActive, onSelect, animate }: SceneProps) {
  const { cells, peaks, maxH } = useMemo(() => buildTerrain(highlights), [highlights]);
  const ground = useRef<THREE.InstancedMesh>(null);
  const peakRefs = useRef<(THREE.Mesh | null)[]>([]);
  const progress = useRef(animate ? 0 : 1);
  const theme = useTheme();
  // Re-read the CSS colour tokens whenever the theme flips.
  const palette = useMemo(() => (theme ? readPalette() : null), [theme]);
  const [risen, setRisen] = useState(!animate);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Colour each ground column by its height, from the base tone to the contour tone.
  useLayoutEffect(() => {
    const mesh = ground.current;
    if (!mesh || !palette) return;
    const color = new THREE.Color();
    cells.forEach((cell, i) => {
      color.copy(palette.base).lerp(palette.high, Math.min(1, cell.h / maxH) ** 0.8);
      mesh.setColorAt(i, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cells, maxH, palette]);

  function place(t: number) {
    const mesh = ground.current;
    if (!mesh) return;
    const k = easeOutCubic(t);
    cells.forEach((cell, i) => {
      const h = Math.max(0.02, cell.h * k);
      dummy.position.set(cell.x, h / 2, cell.z);
      dummy.scale.set(BOX, h, BOX);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    peaks.forEach((p, i) => {
      const m = peakRefs.current[i];
      if (!m) return;
      // Peaks start a little later than the ground so they land last.
      const pk = easeOutCubic(Math.max(0, Math.min(1, (t - 0.15) / 0.85)));
      const h = Math.max(0.02, p.h * pk);
      m.position.set(p.x, h / 2, p.z);
      m.scale.set(BOX, h, BOX);
    });
  }

  useLayoutEffect(() => {
    place(progress.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, peaks]);

  useFrame((_, delta) => {
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta / RISE_SECONDS);
    place(progress.current);
    if (progress.current >= 1) setRisen(true);
  });

  if (!palette) return null;

  return (
    <group>
      <ambientLight intensity={0.85} />
      <directionalLight position={[12, 22, 10]} intensity={1.7} />
      <directionalLight position={[-14, 8, -6]} intensity={0.35} />

      <mesh rotation-x={-Math.PI / 2} position={[-CELL / 2, 0, -CELL / 2]}>
        <planeGeometry args={[COLS * CELL + 2, ROWS * CELL + 2]} />
        <meshBasicMaterial color={palette.line} transparent opacity={0.35} />
      </mesh>

      <instancedMesh ref={ground} args={[undefined, undefined, cells.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} metalness={0} />
      </instancedMesh>

      {peaks.map((p, i) => {
        const isActive = active === i;
        return (
          <mesh
            key={highlights[i].target}
            ref={(m) => {
              peakRefs.current[i] = m;
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onActive(i);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              onActive(null);
              document.body.style.cursor = "";
            }}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelect(i);
            }}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={palette.signal}
              emissive={palette.signal}
              emissiveIntensity={isActive ? 0.45 : 0.08}
              roughness={0.6}
            />
          </mesh>
        );
      })}

      {risen &&
        peaks.map((p, i) => (
          <Html
            key={`label-${highlights[i].target}`}
            position={[p.x, p.h + 0.9, p.z]}
            center
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[12px] font-semibold leading-tight shadow-sm transition-colors ${
                active === i ? "bg-signal text-on-signal" : "bg-surface/90 text-ink"
              }`}
            >
              {highlights[i].value}
            </div>
          </Html>
        ))}
    </group>
  );
}

export default function Terrain3D(props: Omit<SceneProps, "animate">) {
  const [animate] = useState(
    () => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  // Only mouse and trackpad users get drag-to-orbit; on touch screens a drag should scroll the page.
  const [canOrbit] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
  );

  return (
    <Canvas
      camera={{ position: [28, 25, 33], fov: 30, near: 1, far: 300 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: "pan-y" }}
      onPointerMissed={() => props.onActive(null)}
    >
      <Scene {...props} animate={animate} />
      <FitCamera />
      <OrbitControls
        enabled={canOrbit}
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.55}
        maxPolarAngle={1.2}
        target={[-0.5, 1.5, -0.5]}
      />
    </Canvas>
  );
}

/** Keeps the whole terrain in frame: narrower canvases move the camera further back. */
function FitCamera() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useLayoutEffect(() => {
    const aspect = width / Math.max(1, height);
    // Tuned so the 30 x 18 grid plus peak labels just fits at a 1.4:1 canvas.
    const distance = 38 * Math.max(1, 1.4 / aspect);
    const dir = new THREE.Vector3(0.62, 0.55, 0.72).normalize();
    camera.position.copy(dir.multiplyScalar(distance)).add(new THREE.Vector3(-0.5, 1.5, -0.5));
    camera.lookAt(-0.5, 1.5, -0.5);
    camera.updateProjectionMatrix();
  }, [camera, width, height]);

  return null;
}
