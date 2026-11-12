"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getUi, live, setUi, useUi } from "@/lib/drive-store";
import { useWebGL } from "@/lib/client-state";
import { STOP_IDS, uFromStopFloat } from "@/lib/route";
import { Hud } from "./Hud";

// three.js is large: it loads in its own chunk, after the page text is on screen.
const DriveScene = dynamic(() => import("./DriveScene"), { ssr: false });

/**
 * On mouse/trackpad devices the city loads right away. On touch devices it waits for
 * the first scroll or tap (or a few seconds), so a phone's first paint isn't held up
 * parsing three.js on a slow CPU.
 */
function useEngaged() {
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (engaged) return;
    if (window.matchMedia("(pointer: fine)").matches) {
      const id = requestAnimationFrame(() => setEngaged(true));
      return () => cancelAnimationFrame(id);
    }
    const go = () => setEngaged(true);
    const events = ["scroll", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    const timer = window.setTimeout(go, 6000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, go));
      window.clearTimeout(timer);
    };
  }, [engaged]);
  return engaged;
}

/** Maps the page's scroll position to a position along the road. */
function useScrollRoute() {
  useEffect(() => {
    let anchors: number[] = [];

    const onScroll = () => {
      if (!anchors.length) return;
      const y = window.scrollY;
      const n = anchors.length;
      let f = n - 1;
      if (y < anchors[n - 1]) {
        let i = 0;
        while (i < n - 2 && y >= anchors[i + 1]) i++;
        f = i + Math.max(0, (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]));
      }
      live.target = uFromStopFloat(f);
      const stop = Math.min(n - 1, Math.floor(f + 0.45));
      if (stop !== getUi().stop) setUi({ stop });
    };

    const measure = () => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      anchors = STOP_IDS.map((id, i) => {
        const el = document.getElementById(id);
        if (!el || i === 0) return 0;
        const top = el.getBoundingClientRect().top + window.scrollY;
        return Math.min(max, Math.max(0, top - window.innerHeight * 0.18));
      });
      for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
      setUi({ anchors: [...anchors] });
      onScroll();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);
}

export function DriveExperience() {
  const webgl = useWebGL();
  const plain = useUi((s) => s.plain);
  const ready = useUi((s) => s.ready);
  const engaged = useEngaged();
  useScrollRoute();

  const canDrive = webgl !== false;
  const driving = canDrive && !plain;

  useEffect(() => {
    // Without 3D support, show the plain layout (without saving it as a preference).
    if (webgl === false) {
      document.documentElement.dataset.plain = "1";
      if (!getUi().plain) setUi({ plain: true });
    }
  }, [webgl]);

  useEffect(() => {
    // The HUD falls back to scroll position until the scene is drawing again.
    if (!driving && getUi().ready) setUi({ ready: false });
  }, [driving]);

  return (
    <>
      {driving && (
        <div aria-hidden="true" className="drive-backdrop fixed inset-0 z-0">
          {webgl && engaged && (
            <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
              <DriveScene />
            </div>
          )}
        </div>
      )}
      <Hud canDrive={canDrive} />
    </>
  );
}
