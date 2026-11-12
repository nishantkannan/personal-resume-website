"use client";

import { useSyncExternalStore } from "react";

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
