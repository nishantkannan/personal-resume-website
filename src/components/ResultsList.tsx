"use client";

import type { Highlight } from "@/data/resume";
import { getUi, setUi, useUi } from "@/lib/drive-store";
import { locate } from "@/lib/locate";

/** The results shown on the roadside billboards, as a list you can use without the 3D. */
export function ResultsList({ highlights }: { highlights: Highlight[] }) {
  const hover = useUi((s) => s.hoverBillboard);
  const leave = (i: number) => getUi().hoverBillboard === i && setUi({ hoverBillboard: null });

  return (
    <ul className="mt-6 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {highlights.map((h, i) => (
        <li key={h.value}>
          <button
            type="button"
            onMouseEnter={() => setUi({ hoverBillboard: i })}
            onMouseLeave={() => leave(i)}
            onFocus={() => setUi({ hoverBillboard: i })}
            onBlur={() => leave(i)}
            onClick={() => locate(h.target)}
            className={`group flex w-full items-baseline gap-3 border-b border-line py-2.5 text-left transition-colors ${
              hover === i ? "text-ink" : "text-ink-soft"
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block size-2.5 shrink-0 translate-y-[-1px] rounded-[2px] transition-transform ${
                hover === i ? "scale-125 bg-signal" : "bg-signal/70"
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
  );
}
