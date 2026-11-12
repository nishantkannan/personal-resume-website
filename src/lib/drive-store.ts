"use client";

import { useSyncExternalStore } from "react";
import { STOP_U } from "./route";

export type Tod = "day" | "dusk" | "night";

/**
 * Values that change every frame. Read and written directly (no React re-render):
 * the scroll handler writes `target`, the 3D scene smooths it into `pos` and `speed`,
 * and the HUD reads them in its own animation loop.
 */
export const live = {
  /** Where scrolling says the car should be (0..1 along the road). */
  target: STOP_U[0],
  /** Where the car actually is, smoothed. */
  pos: STOP_U[0],
  /** Metres per second. */
  speed: 0,
};

type UiState = {
  tod: Tod;
  plain: boolean;
  /** True once the 3D scene has drawn its first frame. */
  ready: boolean;
  /** Index of the stop the car is at or approaching. */
  stop: number;
  /** Scroll position of each stop, measured from the page. */
  anchors: number[];
  /** Skill group chosen in the Skills panel, lights up its district. */
  skillGroup: number | null;
  /** Result billboard being pointed at, from the 3D scene or the results list. */
  hoverBillboard: number | null;
};

const SERVER: UiState = {
  tod: "day",
  plain: false,
  ready: false,
  stop: 0,
  anchors: [],
  skillGroup: null,
  hoverBillboard: null,
};

let state: UiState = SERVER;
const listeners = new Set<() => void>();

if (typeof document !== "undefined") {
  const d = document.documentElement.dataset;
  state = {
    ...SERVER,
    tod: d.tod === "dusk" || d.tod === "night" ? d.tod : "day",
    plain: d.plain === "1",
  };
}

export function getUi() {
  return state;
}

export function setUi(patch: Partial<UiState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Subscribe to one slice of UI state. Return a primitive from the selector. */
export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(SERVER),
  );
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; the change still applies for this visit.
  }
}

export function setTod(tod: Tod) {
  const el = document.documentElement;
  el.dataset.tod = tod;
  el.dataset.theme = tod === "day" ? "light" : "dark";
  store("tod", tod);
  setUi({ tod });
}

export function setPlain(plain: boolean) {
  const el = document.documentElement;
  if (plain) el.dataset.plain = "1";
  else delete el.dataset.plain;
  store("plain", plain ? "1" : "0");
  setUi({ plain });
}

/** Scroll the page so the car drives to stop i. */
export function goToStop(i: number) {
  const a = state.anchors[i];
  if (a === undefined) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: a, behavior: reduce ? "auto" : "smooth" });
}
