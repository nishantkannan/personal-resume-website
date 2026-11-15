"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ scales */

export type Scale = ((v: number) => number) & { domain: [number, number]; range: [number, number] };

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = ((v: number) => r0 + (v - d0) * k) as Scale;
  f.domain = domain;
  f.range = range;
  return f;
}

/** Round tick values ("nice" steps of 1, 2 or 5 × 10^n). */
export function ticks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

/* -------------------------------------------------------------- formatting */

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
export const num = (v: number, digits = 2) => v.toFixed(digits);
export const int = (v: number) => v.toLocaleString("en-US");

/* ------------------------------------------------------------ measurement */

/** Width of a container, so SVGs draw at real pixel size (crisp 1px rules, readable text). */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ---------------------------------------------------------------- tooltip */

export type Tip = { x: number; y: number; content: ReactNode } | null;

/** A tooltip positioned inside a `relative` chart wrapper; flips to stay inside it. */
export function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width - 190;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[9rem] rounded-lg border border-line bg-surface px-3 py-2 text-[0.8rem] leading-snug shadow-[0_8px_24px_-12px_rgb(0_0_0/0.45)]"
      style={{
        left: flip ? undefined : tip.x + 14,
        right: flip ? width - tip.x + 14 : undefined,
        top: Math.max(0, tip.y - 12),
      }}
    >
      {tip.content}
    </div>
  );
}

export function TipRow({ swatch, label, value }: { swatch?: string; label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-soft">
        {swatch && <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ background: swatch }} />}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------- axes */

const AXIS_TEXT = "fill-ink-soft text-[11px] tabular-nums";

export function XAxis({
  scale,
  y,
  values,
  format = (v) => String(v),
  label,
  grid,
}: {
  scale: Scale;
  y: number;
  values: number[];
  format?: (v: number) => string;
  label?: string;
  grid?: number;
}) {
  return (
    <g>
      {values.map((v) => (
        <g key={v}>
          {grid !== undefined && <line x1={scale(v)} x2={scale(v)} y1={grid} y2={y} className="stroke-viz-grid" />}
          <text x={scale(v)} y={y + 16} textAnchor="middle" className={AXIS_TEXT}>
            {format(v)}
          </text>
        </g>
      ))}
      <line x1={scale.range[0]} x2={scale.range[1]} y1={y} y2={y} stroke="var(--viz-axis)" />
      {label && (
        <text x={(scale.range[0] + scale.range[1]) / 2} y={y + 34} textAnchor="middle" className="fill-ink-soft text-[12px]">
          {label}
        </text>
      )}
    </g>
  );
}

export function YAxis({
  scale,
  x,
  values,
  format = (v) => String(v),
  label,
  gridTo,
}: {
  scale: Scale;
  x: number;
  values: number[];
  format?: (v: number) => string;
  label?: string;
  gridTo?: number;
}) {
  return (
    <g>
      {values.map((v) => (
        <g key={v}>
          {gridTo !== undefined && <line x1={x} x2={gridTo} y1={scale(v)} y2={scale(v)} className="stroke-viz-grid" />}
          <text x={x - 8} y={scale(v) + 4} textAnchor="end" className={AXIS_TEXT}>
            {format(v)}
          </text>
        </g>
      ))}
      {label && (
        <text
          transform={`translate(${x - 44} ${(scale.range[0] + scale.range[1]) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-ink-soft text-[12px]"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ marks */

/** Horizontal bar: square at the baseline, 4px rounded at the data end. */
export function hBarPath(x0: number, x1: number, y: number, h: number, r = 4) {
  const w = x1 - x0;
  if (w <= 0) return "";
  const rr = Math.min(r, w, h / 2);
  return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`;
}

/** Vertical column: square at the baseline, 4px rounded at the top. */
export function vBarPath(x: number, w: number, yTop: number, yBase: number, r = 4) {
  const h = yBase - yTop;
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${yBase}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + w - rr}Q${x + w},${yTop} ${x + w},${yTop + rr}V${yBase}Z`;
}

/* ----------------------------------------------------------------- chrome */

export function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-ink-soft">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={it.line ? "inline-block h-[2px] w-4 rounded-full" : "inline-block size-2.5 rounded-[3px]"}
            style={{ background: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-bg/60 p-0.5 text-[0.8rem]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            value === o.value ? "bg-ink text-bg" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A chart card: title, one-line takeaway, optional controls, and a "show table" fallback. */
export function Figure({
  title,
  takeaway,
  controls,
  legend,
  table,
  children,
  className = "",
}: {
  title: string;
  takeaway?: ReactNode;
  controls?: ReactNode;
  legend?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={`min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <figcaption className="font-semibold leading-snug">{title}</figcaption>
          {takeaway && <p className="mt-1 text-[0.9rem] leading-snug text-ink-soft">{takeaway}</p>}
        </div>
        {controls}
      </div>
      {legend && <div className="mt-3">{legend}</div>}
      <div className="mt-3">{showTable && table ? <div className="overflow-x-auto">{table}</div> : children}</div>
      {table && (
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="mt-3 text-[0.8rem] font-medium text-contour underline-offset-4 hover:underline"
          aria-pressed={showTable}
        >
          {showTable ? "Show chart" : "Show as table"}
        </button>
      )}
    </figure>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-[0.85rem] tabular-nums">
      <thead>
        <tr className="border-b border-line text-ink-soft">
          {head.map((h, i) => (
            <th key={h} scope="col" className={`py-1.5 pr-4 font-medium ${i > 0 ? "text-right" : ""}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/60 last:border-0">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 pr-4 ${j > 0 ? "text-right" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
