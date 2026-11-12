"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { education, experience, highlights, profile, projects, skillGroups } from "@/data/resume";
import { getUi, live, setUi, useUi, type Tod } from "@/lib/drive-store";
import { locate } from "@/lib/locate";
import {
  ROAD_HALF,
  ROUTE_LENGTH,
  STOP_U,
  besideRoad,
  distanceToRoad,
  pointAt,
  rightAt,
  tangentAt,
  yawAt,
} from "@/lib/route";

/* ------------------------------------------------------------------ palette */

type Look = {
  sky: string;
  ground: string;
  walk: string;
  road: string;
  line: string;
  bldg: string[];
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunI: number;
  sunPos: [number, number, number];
  win: number;
  head: number;
  car: string;
};

const LOOKS: Record<Tod, Look> = {
  day: {
    sky: "#c8d6dc",
    ground: "#b3bec3",
    walk: "#cfd7db",
    road: "#3a454c",
    line: "#eef2f3",
    bldg: ["#e6ecee", "#d6dee2", "#c5cfd4", "#b0bdc3", "#97a8b0"],
    hemiSky: "#ffffff",
    hemiGround: "#8a949a",
    hemi: 1.15,
    sun: "#fff3df",
    sunI: 1.7,
    sunPos: [40, 80, 30],
    win: 0,
    head: 0,
    car: "#4f8f99",
  },
  dusk: {
    sky: "#c7907a",
    ground: "#4f4c50",
    walk: "#615d60",
    road: "#2b3035",
    line: "#d9c4b8",
    bldg: ["#6f7279", "#64686f", "#595f67", "#4f565e", "#454c55"],
    hemiSky: "#ffc8a2",
    hemiGround: "#2f2b33",
    hemi: 0.75,
    sun: "#ff9a5e",
    sunI: 1.3,
    sunPos: [-70, 18, -40],
    win: 0.6,
    head: 1,
    car: "#5b9aa4",
  },
  night: {
    sky: "#111b24",
    ground: "#1a242b",
    walk: "#27333c",
    road: "#222d34",
    line: "#9aa8af",
    bldg: ["#43535f", "#3d4d59", "#384753", "#33414c", "#2e3b45"],
    hemiSky: "#8aa3c2",
    hemiGround: "#0e1317",
    hemi: 1.05,
    sun: "#a9c2e2",
    sunI: 0.75,
    sunPos: [-30, 60, 20],
    win: 0.85,
    head: 1.6,
    car: "#6aaab4",
  },
};

const SIGNAL = new THREE.Color("#e3a81b");

/* --------------------------------------------------------------- utilities */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Line = { text: string; size: number; color: string; weight?: number; display?: boolean };

/** Draws a sign onto a canvas and returns it as a texture. Sizes are in canvas pixels. */
function signTexture(w: number, h: number, bg: string, lines: Line[], accent?: string) {
  const scale = 2;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(0, 0, w, h, Math.min(w, h) * 0.07);
  g.fill();
  if (accent) {
    g.fillStyle = accent;
    g.fillRect(0, h - 10, w, 10);
  }
  const display = cssFont("--font-archivo", "system-ui");
  const body = cssFont("--font-plex", "system-ui");
  const pad = w * 0.07;
  const gap = 0.32;
  const total = lines.reduce((s, l, i) => s + l.size * (i ? 1 + gap : 1), 0);
  let y = (h - total) / 2;
  g.textBaseline = "top";
  lines.forEach((l, i) => {
    if (i) y += l.size * gap;
    const ctx = g as CanvasRenderingContext2D & { fontStretch?: string };
    ctx.fontStretch = l.display ? "expanded" : "normal";
    g.font = `${l.weight ?? 500} ${l.size}px ${l.display ? display : body}`;
    g.fillStyle = l.color;
    g.fillText(l.text, pad, y, w - pad * 2);
    y += l.size;
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function radialTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Faces a flat sign so it reads from the road a little behind it. */
function faceBack(obj: THREE.Object3D, u: number) {
  const back = pointAt(Math.max(0, u - 0.03));
  obj.lookAt(back.x, obj.position.y, back.z);
}

/* -------------------------------------------------------- landmark layout */

const SEG = STOP_U[1] - STOP_U[0];
/** Landmarks sit a little ahead of their stop, so they are in view when the car arrives. */
const LEAD = SEG * 0.3;

const BILLBOARD_U = highlights.map((_, k) => STOP_U[1] + LEAD * 1.3 + (k - (highlights.length - 1) / 2) * SEG * 0.14);
const DISTRICT_U = skillGroups.map((_, g) => STOP_U[3] + LEAD * 0.5 - SEG * 0.3 + (g + 0.5) * ((SEG * 0.6) / skillGroups.length));
const TOWER_U = [-1, 0, 1].map((j) => STOP_U[4] + LEAD + j * 0.017);

type Zone = { x: number; z: number; r: number };

const ZONES: Zone[] = [
  ...BILLBOARD_U.map((u) => ({ ...besideRoad(u, 11), r: 6 })),
  ...DISTRICT_U.map((u) => ({ ...besideRoad(u, 9.5), r: 4 })),
  ...TOWER_U.map((u) => ({ ...besideRoad(u, 18), r: 11 })),
  { ...besideRoad(STOP_U[2], 18), r: 15 },
  { ...besideRoad(STOP_U[5] + LEAD, 16), r: 13 },
  { ...besideRoad(STOP_U[6] + LEAD, 20), r: 18 },
  { ...besideRoad(STOP_U[7] + 0.022, 9), r: 13 },
];

function inZone(x: number, z: number, pad = 0) {
  return ZONES.some((zn) => (zn.x - x) ** 2 + (zn.z - z) ** 2 < (zn.r + pad) ** 2);
}

/* --------------------------------------------------------------- buildings */

type Building = { x: number; z: number; w: number; d: number; h: number; yaw: number; tone: number; district: number };

function genBuildings(lite: boolean): Building[] {
  const rnd = mulberry32(11);
  const out: Building[] = [];
  const step = 7.5 / ROUTE_LENGTH;
  const rows = lite ? [0] : [0, 1];
  const districtStart = STOP_U[3] + LEAD * 0.5 - SEG * 0.3;
  const districtSpan = (SEG * 0.6) / skillGroups.length;
  for (let u = 0; u <= 1; u += step) {
    for (const side of [-1, 1]) {
      for (const row of rows) {
        if (rnd() < 0.16) continue;
        const w = 6 + rnd() * 7;
        const d = 6 + rnd() * 7;
        const half = Math.max(w, d) / 2;
        const off = row === 0 ? ROAD_HALF + 4.5 + half + rnd() * 2.5 : 27 + rnd() * 16;
        const uu = u + (rnd() - 0.5) * step * 0.6;
        const p = besideRoad(uu, side * off);
        if (distanceToRoad(p.x, p.z) < ROAD_HALF + 3.5 + half) continue;
        if (inZone(p.x, p.z, half)) continue;
        const h = (row === 0 ? 7 : 14) + rnd() ** 1.6 * (row === 0 ? 30 : 46);
        const k = Math.floor((uu - districtStart) / districtSpan);
        const district = side === 1 && row === 0 && k >= 0 && k < skillGroups.length ? k : -1;
        out.push({ x: p.x, z: p.z, w, d, h, yaw: yawAt(uu), tone: Math.floor(rnd() * 5), district });
      }
    }
  }
  return out;
}

let buildingMaterial: { mat: THREE.MeshStandardMaterial; uniforms: { uWin: { value: THREE.Color }; uDay: { value: number } } } | null = null;

/** One shared building material (module-level so React treats it as external state). */
function getBuildingMaterial() {
  if (buildingMaterial) return buildingMaterial;
  const uniforms = { uWin: { value: new THREE.Color(0, 0, 0) }, uDay: { value: 1 } };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wpos = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wpos = instanceMatrix * wpos;
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWPos = (modelMatrix * wpos).xyz;
        vWN = wn;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWN;
        uniform vec3 uWin;
        uniform float uDay;
        vec2 winGrid() {
          vec3 n = normalize(vWN);
          vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n) + 1e-4);
          return vec2(dot(vWPos, t) / 2.6, vWPos.y / 3.2);
        }
        float winMask() {
          vec3 n = normalize(vWN);
          float wall = 1.0 - step(0.5, abs(n.y));
          vec2 f = fract(winGrid());
          float w = step(0.32, f.x) * step(f.x, 0.68) * step(0.38, f.y) * step(f.y, 0.74);
          return w * wall * step(3.0, vWPos.y);
        }
        float winLit() {
          vec2 g = floor(winGrid());
          return step(0.62, fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453));
        }`,
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\nfloat wm = winMask();\ndiffuseColor.rgb *= 1.0 - 0.3 * wm * uDay;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uWin * wm * winLit();");
  };
  mat.customProgramCacheKey = () => "resume-building-windows";
  buildingMaterial = { mat, uniforms };
  return buildingMaterial;
}

function Buildings({ look, tod, lite, skillGroup }: { look: Look; tod: Tod; lite: boolean; skillGroup: number | null }) {
  const list = useMemo(() => genBuildings(lite), [lite]);
  const { mat } = getBuildingMaterial();
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    list.forEach((b, i) => {
      o.position.set(b.x, 0, b.z);
      o.rotation.set(0, b.yaw, 0);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    list.forEach((b, i) => {
      c.set(look.bldg[b.tone]);
      if (skillGroup !== null && b.district === skillGroup) c.lerp(SIGNAL, tod === "day" ? 0.6 : 0.45);
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const { uniforms } = getBuildingMaterial();
    uniforms.uWin.value.set("#ffd38a").multiplyScalar(look.win);
    uniforms.uDay.value = tod === "day" ? 1 : 0.25;
  }, [list, look, tod, skillGroup]);

  return <instancedMesh ref={ref} args={[geo, mat, list.length]} frustumCulled={false} />;
}

/* ------------------------------------------------------------------- trees */

function Trees({ look, lite }: { look: Look; lite: boolean }) {
  const spots = useMemo(() => {
    const rnd = mulberry32(5);
    const out: { x: number; z: number; s: number }[] = [];
    const step = (lite ? 16 : 10) / ROUTE_LENGTH;
    for (let u = 0.02; u < 1; u += step) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const p = besideRoad(u, side * (ROAD_HALF + 2.3));
        if (inZone(p.x, p.z, 1)) continue;
        out.push({ ...p, s: 0.8 + rnd() * 0.5 });
      }
    }
    // A small park at the About stop.
    const park = besideRoad(STOP_U[2], 18);
    for (let i = 0; i < (lite ? 8 : 16); i++) {
      out.push({ x: park.x + (rnd() - 0.5) * 22, z: park.z + (rnd() - 0.5) * 22, s: 1 + rnd() * 0.7 });
    }
    return out;
  }, [lite]);

  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    spots.forEach((t, i) => {
      o.position.set(t.x, 0.9 * t.s, t.z);
      o.scale.setScalar(t.s);
      o.updateMatrix();
      trunk.current?.setMatrixAt(i, o.matrix);
      o.position.set(t.x, 2.6 * t.s, t.z);
      o.updateMatrix();
      crown.current?.setMatrixAt(i, o.matrix);
    });
    if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true;
    if (crown.current) crown.current.instanceMatrix.needsUpdate = true;
  }, [spots]);

  const leaf = look === LOOKS.day ? "#7f9e86" : look === LOOKS.dusk ? "#55624f" : "#1f2d26";
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.12, 0.16, 1.8, 6]} />
        <meshStandardMaterial color="#5d5048" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1.35, 0]} />
        <meshStandardMaterial color={leaf} roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

/* -------------------------------------------------------------------- road */

function ribbon(halfOuter: number, halfInner: number, y: number, step = 4) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = Math.ceil(ROUTE_LENGTH / step);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = pointAt(u);
    const r = rightAt(u);
    for (const s of [-1, 1]) {
      pos.push(p.x + r.x * s * halfOuter, y, p.z + r.z * s * halfOuter);
      pos.push(p.x + r.x * s * halfInner, y, p.z + r.z * s * halfInner);
    }
    if (i < n) {
      const a = i * 4;
      const b = a + 4;
      // left strip (outer..inner) and right strip
      idx.push(a, a + 1, b, a + 1, b + 1, b);
      idx.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Road({ look }: { look: Look }) {
  const surface = useMemo(() => ribbon(ROAD_HALF, 0, 0.02), []);
  const walk = useMemo(() => ribbon(ROAD_HALF + 4, ROAD_HALF, 0.06), []);
  const edges = useMemo(() => ribbon(ROAD_HALF - 0.35, ROAD_HALF - 0.5, 0.04), []);
  const dashes = useRef<THREE.InstancedMesh>(null);
  const dashCount = Math.floor(ROUTE_LENGTH / 7);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < dashCount; i++) {
      const u = (i + 0.5) / dashCount;
      const p = pointAt(u);
      o.position.set(p.x, 0.045, p.z);
      o.rotation.set(-Math.PI / 2, 0, yawAt(u));
      o.updateMatrix();
      dashes.current?.setMatrixAt(i, o.matrix);
    }
    if (dashes.current) dashes.current.instanceMatrix.needsUpdate = true;
  }, [dashCount]);

  // Start line just past the first stop.
  const start = pointAt(STOP_U[0] + 0.006);
  const startYaw = yawAt(STOP_U[0] + 0.006);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -ROUTE_LENGTH / 2 + 40]}>
        <planeGeometry args={[900, ROUTE_LENGTH + 500]} />
        <meshStandardMaterial color={look.ground} roughness={1} />
      </mesh>
      <mesh geometry={walk}>
        <meshStandardMaterial color={look.walk} roughness={1} />
      </mesh>
      <mesh geometry={surface}>
        <meshStandardMaterial color={look.road} roughness={0.95} />
      </mesh>
      <mesh geometry={edges}>
        <meshBasicMaterial color={look.line} />
      </mesh>
      <instancedMesh ref={dashes} args={[undefined, undefined, dashCount]} frustumCulled={false}>
        <planeGeometry args={[0.22, 2.8]} />
        <meshBasicMaterial color={look.line} />
      </instancedMesh>
      <mesh position={[start.x, 0.05, start.z]} rotation={[-Math.PI / 2, 0, startYaw]}>
        <planeGeometry args={[ROAD_HALF * 2, 0.8]} />
        <meshBasicMaterial color={look.line} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------- landmarks */

function SignBoard({
  u,
  side,
  height,
  size,
  texture,
  glow,
  onOver,
  onOut,
  onClick,
}: {
  u: number;
  side: number;
  height: number;
  size: [number, number];
  texture: THREE.Texture;
  glow: number;
  onOver?: () => void;
  onOut?: () => void;
  onClick?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const p = besideRoad(u, side);
  useLayoutEffect(() => {
    if (group.current) faceBack(group.current, u);
  }, [u]);
  const interactive = Boolean(onClick);
  return (
    <group ref={group} position={[p.x, 0, p.z]}>
      <mesh position={[-size[0] * 0.3, height / 2, -0.15]}>
        <boxGeometry args={[0.22, height, 0.22]} />
        <meshStandardMaterial color="#56636b" />
      </mesh>
      <mesh position={[size[0] * 0.3, height / 2, -0.15]}>
        <boxGeometry args={[0.22, height, 0.22]} />
        <meshStandardMaterial color="#56636b" />
      </mesh>
      <mesh
        position={[0, height + size[1] / 2, 0]}
        onPointerOver={
          interactive
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
                onOver?.();
              }
            : undefined
        }
        onPointerOut={
          interactive
            ? () => {
                document.body.style.cursor = "";
                onOut?.();
              }
            : undefined
        }
        onClick={
          interactive
            ? (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onClick?.();
              }
            : undefined
        }
      >
        <planeGeometry args={size} />
        <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={glow} roughness={0.7} />
      </mesh>
      <mesh position={[0, height + size[1] / 2, -0.08]}>
        <boxGeometry args={[size[0] + 0.3, size[1] + 0.3, 0.12]} />
        <meshStandardMaterial color="#2a353d" />
      </mesh>
    </group>
  );
}

function Landmarks({ look, tod, skillGroup }: { look: Look; tod: Tod; skillGroup: number | null }) {
  const hover = useUi((s) => s.hoverBillboard);
  const night = tod !== "day";
  const ink = "#e9eef0";
  const dim = "#a7b3b9";
  const panel = "#1f2b33";

  const tex = useMemo(() => {
    const billboards = highlights.map((h) =>
      signTexture(
        800,
        400,
        panel,
        [
          { text: h.value, size: 150, color: "#e3a81b", weight: 800, display: true },
          { text: h.label, size: 46, color: ink },
        ],
        "#e3a81b",
      ),
    );
    const gantry = signTexture(1200, 300, "#2f5960", [
      { text: profile.name, size: 110, color: "#ffffff", weight: 800, display: true },
      { text: profile.role, size: 44, color: "#d7e6e9" },
    ]);
    const districts = skillGroups.map((g) =>
      signTexture(700, 260, panel, [
        { text: g.name, size: 64, color: ink, weight: 700, display: true },
        { text: g.description, size: 34, color: dim },
      ]),
    );
    const roles = [...experience.roles].reverse();
    const towers = roles.map((r) =>
      signTexture(700, 300, panel, [
        { text: r.title, size: 56, color: ink, weight: 700, display: true },
        { text: `${r.start} to ${r.end}`, size: 36, color: dim },
      ]),
    );
    const project = projects[0];
    const podium = signTexture(800, 300, panel, [
      { text: project.name.replace("Caterpillar ", ""), size: 62, color: ink, weight: 700, display: true },
      { text: project.result, size: 52, color: "#e3a81b", weight: 600 },
    ]);
    const campus = signTexture(900, 300, panel, [
      { text: education.school.split(",")[0], size: 64, color: ink, weight: 700, display: true },
      { text: education.degree, size: 34, color: dim },
    ]);
    const destination = signTexture(800, 300, "#2f5960", [
      { text: "Destination", size: 44, color: "#d7e6e9" },
      { text: "Get in touch", size: 92, color: "#ffffff", weight: 800, display: true },
    ]);
    return { billboards, gantry, districts, towers, podium, campus, destination };
  }, []);

  useEffect(
    () => () => {
      Object.values(tex)
        .flat()
        .forEach((t) => t.dispose());
    },
    [tex],
  );

  const base = night ? 0.55 : 0.12;

  // Gantry over the road at the start.
  const gU = STOP_U[0] + 0.014;
  const gP = pointAt(gU);
  const gantryRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (gantryRef.current) faceBack(gantryRef.current, gU);
  }, [gU]);

  const towerHeights = [20, 32, 46];
  const ringP = pointAt(STOP_U[7]);

  return (
    <group>
      <group ref={gantryRef} position={[gP.x, 0, gP.z]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (ROAD_HALF + 1.4), 3.7, 0]}>
            <boxGeometry args={[0.35, 7.4, 0.35]} />
            <meshStandardMaterial color="#56636b" />
          </mesh>
        ))}
        <mesh position={[0, 7.2, -0.2]}>
          <boxGeometry args={[ROAD_HALF * 2 + 3.4, 0.5, 0.4]} />
          <meshStandardMaterial color="#56636b" />
        </mesh>
        <mesh position={[0, 5.6, 0.05]}>
          <planeGeometry args={[10, 2.5]} />
          <meshStandardMaterial map={tex.gantry} emissiveMap={tex.gantry} emissive="#ffffff" emissiveIntensity={base} />
        </mesh>
      </group>

      {highlights.map((h, k) => (
        <SignBoard
          key={h.value}
          u={BILLBOARD_U[k]}
          side={11}
          height={3.2}
          size={[8, 4]}
          texture={tex.billboards[k]}
          glow={hover === k ? 0.95 : base}
          onOver={() => setUi({ hoverBillboard: k })}
          onOut={() => getUi().hoverBillboard === k && setUi({ hoverBillboard: null })}
          onClick={() => locate(h.target)}
        />
      ))}

      {skillGroups.map((g, k) => (
        <SignBoard
          key={g.name}
          u={DISTRICT_U[k]}
          side={9.5}
          height={1.8}
          size={[5.6, 2.1]}
          texture={tex.districts[k]}
          glow={skillGroup === k ? 0.9 : base}
        />
      ))}

      {TOWER_U.map((u, j) => {
        const p = besideRoad(u, 18);
        const current = j === TOWER_U.length - 1;
        return (
          <group key={u}>
            <mesh position={[p.x, towerHeights[j] / 2, p.z]} rotation-y={yawAt(u)}>
              <boxGeometry args={[9, towerHeights[j], 9]} />
              <meshStandardMaterial color={look === LOOKS.day ? "#5d8f98" : "#3e6f78"} roughness={0.6} />
            </mesh>
            <mesh position={[p.x, towerHeights[j] + 0.6, p.z]} rotation-y={yawAt(u)}>
              <boxGeometry args={[9.4, 1.2, 9.4]} />
              <meshStandardMaterial
                color={current ? "#e3a81b" : "#8fb3ba"}
                emissive={current ? "#e3a81b" : "#000000"}
                emissiveIntensity={current ? (night ? 1.2 : 0.3) : 0}
              />
            </mesh>
            <SignBoard u={u} side={11.5} height={0.9} size={[4.6, 2]} texture={tex.towers[j]} glow={base} />
          </group>
        );
      })}

      {(() => {
        const u = STOP_U[5] + LEAD;
        const p = besideRoad(u, 16);
        const yaw = yawAt(u);
        const r = rightAt(u);
        const t = tangentAt(u);
        const steps: [number, number, string][] = [
          [-3.4, 3.2, "#e3a81b"],
          [0, 4.4, "#8fb3ba"],
          [3.4, 2.2, "#8fb3ba"],
        ];
        return (
          <group>
            {steps.map(([along, h, color]) => (
              <mesh key={along} position={[p.x + t.x * along, h / 2, p.z + t.z * along]} rotation-y={yaw}>
                <boxGeometry args={[4.2, h, 3.4]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color === "#e3a81b" ? color : "#000000"}
                  emissiveIntensity={color === "#e3a81b" && night ? 0.8 : 0}
                />
              </mesh>
            ))}
            <SignBoard u={u - 0.004} side={9.5} height={1.6} size={[5.6, 2.1]} texture={tex.podium} glow={base} />
            <mesh position={[p.x + r.x * 2, 0.03, p.z + r.z * 2]} rotation={[-Math.PI / 2, 0, yaw]}>
              <planeGeometry args={[16, 12]} />
              <meshStandardMaterial color={look.walk} />
            </mesh>
          </group>
        );
      })()}

      {(() => {
        const u = STOP_U[6] + LEAD;
        const yaw = yawAt(u);
        const blocks: [number, number, number, number][] = [
          [-8, 22, 16, 7],
          [8, 26, 12, 9],
          [0, 32, 20, 6],
        ];
        return (
          <group>
            {blocks.map(([along, side, w, h]) => {
              const p = besideRoad(u + along / ROUTE_LENGTH, side);
              return (
                <mesh key={along} position={[p.x, h / 2, p.z]} rotation-y={yaw}>
                  <boxGeometry args={[w, h, 8]} />
                  <meshStandardMaterial color={look === LOOKS.day ? "#c9b49b" : "#5a4d42"} roughness={0.9} />
                </mesh>
              );
            })}
            <SignBoard u={u - 0.006} side={10} height={1.6} size={[6.4, 2.1]} texture={tex.campus} glow={base} />
          </group>
        );
      })()}

      <SignBoard u={STOP_U[7] + 0.022} side={9} height={2.4} size={[6, 2.25]} texture={tex.destination} glow={night ? 0.7 : 0.2} />
      <mesh position={[ringP.x, 0.07, ringP.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.2, 3.7, 48]} />
        <meshBasicMaterial color="#e3a81b" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------------- car */

function Car({ look }: { look: Look }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Mesh | null)[]>([]);
  const tail = useRef<THREE.MeshStandardMaterial>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const look_ = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  const started = useRef<number | null>(null);
  const camYaw = useRef(0);
  const spin = useRef(0);
  const lastSpeed = useRef(0);
  const firstFrame = useRef(true);
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const narrow = useThree((s) => s.size.width < 768);

  const shadowTex = useMemo(() => radialTexture("rgba(0,0,0,0.55)", "rgba(0,0,0,0)"), []);
  const beamTex = useMemo(() => radialTexture("rgba(255,244,214,0.9)", "rgba(255,244,214,0)"), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    const prev = live.pos;
    live.pos += (live.target - live.pos) * (1 - Math.exp(-dt * 2.4));
    const moved = (live.pos - prev) * ROUTE_LENGTH;
    const v = Math.abs(moved) / Math.max(dt, 1e-3);
    live.speed += (v - live.speed) * (1 - Math.exp(-dt * 6));
    const accel = (live.speed - lastSpeed.current) / Math.max(dt, 1e-3);
    lastSpeed.current = live.speed;

    const u = live.pos;
    const p = pointAt(u);
    const t = tangentAt(u);
    const yaw = Math.atan2(t.x, t.z);
    const yawAhead = yawAt(Math.min(1, u + 0.004));
    const turn = Math.atan2(Math.sin(yawAhead - yaw), Math.cos(yawAhead - yaw));

    if (root.current) {
      root.current.position.set(p.x, 0, p.z);
      root.current.rotation.y = yaw;
    }
    if (body.current) {
      body.current.rotation.x = THREE.MathUtils.clamp(-accel * 0.0035, -0.05, 0.05);
      body.current.rotation.z = THREE.MathUtils.clamp(turn * live.speed * 0.02, -0.06, 0.06);
      body.current.position.y = reduce ? 0 : Math.sin(state.clock.elapsedTime * 22) * 0.008 * (live.speed < 0.5 ? 1 : 0);
    }
    spin.current += moved / 0.38;
    wheels.current.forEach((w) => {
      if (w) w.rotation.x = spin.current;
    });
    if (tail.current) tail.current.emissiveIntensity = accel < -4 && live.speed > 1 ? 2.4 : 0.6 + look.head * 0.3;
    if (beam.current) beam.current.opacity = look.head * 0.32;

    // Chase camera. On the first load it swoops down from above once.
    if (started.current === null) started.current = state.clock.elapsedTime;
    const intro = reduce ? 1 : THREE.MathUtils.smoothstep(state.clock.elapsedTime - started.current, 0, 2.2);
    const back = THREE.MathUtils.lerp(30, narrow ? 13 : 11.5, intro);
    const up = THREE.MathUtils.lerp(30, narrow ? 5.6 : 4.6, intro);
    // The camera stays a fixed distance behind the car; only its heading is smoothed,
    // so it swings gently through bends without ever falling behind on fast scrolls.
    if (firstFrame.current) {
      camYaw.current = yaw;
      firstFrame.current = false;
      setUi({ ready: true });
    }
    const k = 1 - Math.exp(-dt * 4);
    camYaw.current += Math.atan2(Math.sin(yaw - camYaw.current), Math.cos(yaw - camYaw.current)) * k;
    const dx = Math.sin(camYaw.current);
    const dz = Math.cos(camYaw.current);
    camPos.current.set(p.x - dx * back, up, p.z - dz * back);
    look_.current.set(p.x + dx * 7, 1.3, p.z + dz * 7);
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.position.copy(camPos.current);
    cam.lookAt(look_.current);
    const pc = cam;
    const fov = 48 + Math.min(live.speed, 70) * 0.1;
    if (Math.abs(pc.fov - fov) > 0.05) {
      pc.fov += (fov - pc.fov) * k;
      pc.updateProjectionMatrix();
    }
  });

  const wheelPos: [number, number, number][] = [
    [-0.98, 0.38, 1.35],
    [0.98, 0.38, 1.35],
    [-0.98, 0.38, -1.35],
    [0.98, 0.38, -1.35],
  ];

  return (
    <group ref={root}>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3, 5.6]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, 9]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[6, 14]} />
        <meshBasicMaterial ref={beam} map={beamTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={body}>
        <RoundedBox args={[1.95, 0.62, 4.3]} radius={0.2} smoothness={3} position={[0, 0.66, 0]}>
          <meshStandardMaterial color={look.car} roughness={0.35} metalness={0.15} />
        </RoundedBox>
        <RoundedBox args={[1.62, 0.52, 2.1]} radius={0.18} smoothness={3} position={[0, 1.18, -0.25]}>
          <meshStandardMaterial color="#2b3c46" roughness={0.12} metalness={0.4} />
        </RoundedBox>
        {[-0.62, 0.62].map((x) => (
          <mesh key={`h${x}`} position={[x, 0.72, 2.16]}>
            <boxGeometry args={[0.42, 0.12, 0.04]} />
            <meshStandardMaterial color="#ffffff" emissive="#fff4d6" emissiveIntensity={0.6 + look.head * 1.4} />
          </mesh>
        ))}
        {[-0.62, 0.62].map((x) => (
          <mesh key={`t${x}`} position={[x, 0.74, -2.16]}>
            <boxGeometry args={[0.46, 0.1, 0.04]} />
            <meshStandardMaterial ref={x < 0 ? tail : undefined} color="#7a1b16" emissive="#ff3b2f" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      {wheelPos.map((w, i) => (
        <mesh
          key={i}
          position={w}
          rotation-z={Math.PI / 2}
          ref={(m) => {
            wheels.current[i] = m;
          }}
        >
          <cylinderGeometry args={[0.38, 0.38, 0.3, 14]} />
          <meshStandardMaterial color="#141a1e" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------- scene */

function Atmosphere({ look }: { look: Look }) {
  return (
    <>
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, 50, 280]} />
      <hemisphereLight args={[look.hemiSky, look.hemiGround, look.hemi]} />
      <directionalLight position={look.sunPos} color={look.sun} intensity={look.sunI} />
    </>
  );
}

/** On wide screens, shifts the view so the road sits to the right of the content panels. */
function ViewOffset() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (size.width >= 1024) cam.setViewOffset(size.width, size.height, -size.width * 0.1, 0, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function DriveScene() {
  const tod = useUi((s) => s.tod);
  const skillGroup = useUi((s) => s.skillGroup);
  const look = LOOKS[tod];
  const [fontsReady, setFontsReady] = useState(false);
  const [lite] = useState(() => window.matchMedia("(max-width: 767px), (pointer: coarse)").matches);

  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Canvas
      dpr={[1, lite ? 1.5 : 2]}
      gl={{ antialias: !lite, powerPreference: "high-performance" }}
      camera={{ fov: 48, near: 0.5, far: 520, position: [0, 30, 70] }}
      style={{ touchAction: "pan-y" }}
      onPointerMissed={() => getUi().hoverBillboard !== null && setUi({ hoverBillboard: null })}
    >
      <Atmosphere look={look} />
      <ViewOffset />
      <Road look={look} />
      <Buildings look={look} tod={tod} lite={lite} skillGroup={skillGroup} />
      <Trees look={look} lite={lite} />
      {fontsReady && <Landmarks look={look} tod={tod} skillGroup={skillGroup} />}
      <Car look={look} />
    </Canvas>
  );
}
