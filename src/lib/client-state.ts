"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

function subscribeTheme(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  return () => window.removeEventListener("themechange", onChange);
}

/** The theme set on <html data-theme>, or null during server rendering. */
export function useTheme(): Theme | null {
  return useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => null,
  );
}

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    // Storage can be blocked; the theme still changes for this visit.
  }
  window.dispatchEvent(new Event("themechange"));
}

let webglCache: boolean | undefined;
function detectWebGL() {
  if (webglCache === undefined) {
    try {
      const c = document.createElement("canvas");
      webglCache = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}

const noSubscribe = () => () => {};

/** Whether the browser can draw 3D, or null during server rendering. */
export function useWebGL(): boolean | null {
  return useSyncExternalStore(noSubscribe, detectWebGL, () => null);
}
