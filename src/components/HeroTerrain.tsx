"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Highlight } from "@/data/resume";
import { useWebGL } from "@/lib/client-state";
import { locate } from "@/lib/locate";

// three.js is large, so it loads only once the terrain is mostly on screen.
// Until then (and on browsers without WebGL) a flat still version stands in.
const Terrain3D = dynamic(() => import("./Terrain3D"), {
  ssr: false,
  loading: () => <StaticTerrain faint />,
});

/**
 * True once at least half of the element has been on screen. On touch devices it also waits
 * for the first scroll or tap (or a few seconds), so a phone's first paint isn't held up
 * parsing three.js on a slow CPU.
 */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
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

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen && engaged] as const;
}

export function HeroTerrain({ highlights }: { highlights: Highlight[] }) {
  const [active, setActive] = useState<number | null>(null);
  const webgl = useWebGL();
  const [frame, seen] = useSeen<HTMLDivElement>();

  const select = (i: number) => locate(highlights[i].target);

  return (
    <div className="flex flex-col gap-5">
      <div
        ref={frame}
        className="relative h-[320px] w-full sm:h-[400px] lg:h-[460px]"
        role="img"
        aria-label="A 3D terrain of data columns. The highlighted peaks are career results, listed below."
      >
        {webgl && seen ? (
          <Terrain3D
            highlights={highlights}
            active={active}
            onActive={setActive}
            onSelect={select}
          />
        ) : (
          <StaticTerrain faint={webgl !== false} />
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Results on the map</h2>
        <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {highlights.map((h, i) => (
            <li key={h.value}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => select(i)}
                className={`group flex w-full items-baseline gap-3 border-b border-line py-2 text-left transition-colors ${
                  active === i ? "text-ink" : "text-ink-soft"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block size-2.5 shrink-0 translate-y-[-1px] rounded-[2px] transition-transform ${
                    active === i ? "scale-125 bg-signal" : "bg-signal/70"
                  }`}
                />
                <span className="w-[5.5rem] shrink-0 font-semibold text-ink">{h.value}</span>
                <span className="text-[0.95rem] group-hover:underline group-hover:decoration-contour group-hover:underline-offset-4">
                  {h.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-soft">
          Select a result to jump to where it happened.
          <span className="hidden [@media(pointer:fine)]:inline"> Drag the terrain to look around.</span>
        </p>
      </div>
    </div>
  );
}

/** Shown when the browser can't draw 3D: a flat side view of the same idea. */
function StaticTerrain({ faint = false }: { faint?: boolean }) {
  const bars = [2, 3, 4, 6, 9, 6, 4, 3, 5, 8, 12, 8, 5, 4, 3, 4, 7, 10, 7, 4, 3, 2];
  const peaks = new Set([4, 10, 17]);
  return (
    <svg viewBox="0 0 220 130" className={`size-full ${faint ? "opacity-30" : ""}`} aria-hidden="true">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={i * 10 + 1}
          y={120 - b * 9}
          width={8}
          height={b * 9}
          fill={peaks.has(i) ? "var(--signal)" : "var(--terrain-high)"}
          opacity={peaks.has(i) ? 1 : 0.35 + b / 20}
        />
      ))}
      <line x1="0" x2="220" y1="120.5" y2="120.5" stroke="var(--line)" />
    </svg>
  );
}
