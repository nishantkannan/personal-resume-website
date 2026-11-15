"use client";

import { useState } from "react";
import type { SegmentRow } from "@/lib/churn-report";
import { DataTable, Figure, Tooltip, TipRow, hBarPath, int, linear, pct, useWidth, type Tip } from "./primitives";

/* ------------------------------------------------- churn rate by segment */

type Segment = { key: string; title: string; rows: SegmentRow[] };

/** Small multiples: one panel per attribute, bars share a 0-100% scale so panels compare. */
export function SegmentGrid({ segments, overall }: { segments: Segment[]; overall: number }) {
  const max = Math.min(1, Math.ceil(Math.max(...segments.flatMap((s) => s.rows.map((r) => r.churn_rate))) * 10) / 10);
  return (
    <Figure
      title="Churn rate by customer group"
      takeaway={<>Every panel uses the same scale. The thin vertical rule is the overall rate, {pct(overall, 1)}.</>}
      table={
        <DataTable
          head={["Group", "Churn rate", "Customers"]}
          rows={segments.flatMap((s) => s.rows.map((r) => [`${s.title}: ${r.group}`, pct(r.churn_rate, 1), int(r.n)]))}
        />
      }
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((s) => (
          <SegmentPanel key={s.key} segment={s} max={max} overall={overall} />
        ))}
      </div>
    </Figure>
  );
}

function SegmentPanel({ segment, max, overall }: { segment: Segment; max: number; overall: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(300);
  const [tip, setTip] = useState<Tip>(null);
  const labelW = 74;
  const valueW = 40;
  const rowH = 26;
  const barH = 14;
  const x = linear([0, max], [labelW, width - valueW]);
  const h = segment.rows.length * rowH + 4;

  return (
    <div ref={ref} className="relative min-w-0">
      <p className="mb-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-ink-soft">{segment.title}</p>
      <svg width={width} height={h} role="img" aria-label={`Churn rate by ${segment.title.toLowerCase()}`}>
        <line x1={x(overall)} x2={x(overall)} y1={0} y2={h} stroke="var(--ink)" strokeOpacity={0.4} />
        {segment.rows.map((r, i) => {
          const y = i * rowH + 4;
          return (
            <g
              key={r.group}
              onMouseMove={(e) => {
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top + 18,
                  content: (
                    <>
                      <p className="mb-1 font-semibold">{r.group}</p>
                      <TipRow label="Churn rate" value={pct(r.churn_rate, 1)} />
                      <TipRow label="Customers" value={int(r.n)} />
                    </>
                  ),
                });
              }}
              onMouseLeave={() => setTip(null)}
            >
              <rect x={0} y={y - 4} width={width} height={rowH} fill="transparent" />
              <text x={0} y={y + barH / 2 + 4} className="fill-ink text-[12px]">
                {r.group}
              </text>
              <path d={hBarPath(labelW, x(r.churn_rate), y, barH)} fill="var(--viz-churn)" />
              <text x={x(r.churn_rate) + 6} y={y + barH / 2 + 4} className="fill-ink-soft text-[11px] tabular-nums">
                {pct(r.churn_rate)}
              </text>
            </g>
          );
        })}
        <line x1={labelW} x2={labelW} y1={0} y2={h} stroke="var(--viz-axis)" />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ----------------------------------------------------- age distribution */

type AgeBin = { lo: number; hi: number; stayed: number; churned: number };

/** Churn rate across age, with the customer count behind each point as faint columns. */
export function AgeChart({ bins, overall }: { bins: AgeBin[]; overall: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const data = bins.filter((b) => b.stayed + b.churned >= 20);
  const m = { l: 44, r: 12, t: 12, b: 40 };
  const H = 220;
  const x = linear([data[0].lo, data[data.length - 1].hi], [m.l, width - m.r]);
  const y = linear([0, 1], [H - m.b, m.t]);
  const rate = (b: AgeBin) => b.churned / (b.stayed + b.churned);
  const pts = data.map((b) => [x((b.lo + b.hi) / 2), y(rate(b))] as const);
  const peak = data.reduce((a, b) => (rate(b) > rate(a) ? b : a));
  const hb = hover === null ? null : data[hover];

  return (
    <Figure
      title="Churn rate by age"
      takeaway={
        <>
          Risk climbs steeply through middle age and peaks at {pct(rate(peak))} for ages {peak.lo}-{peak.hi - 1}. Age is the strongest
          single signal in the data.
        </>
      }
      table={
        <DataTable
          head={["Age", "Customers", "Churned", "Churn rate"]}
          rows={data.map((b) => [`${b.lo}-${b.hi - 1}`, int(b.stayed + b.churned), int(b.churned), pct(rate(b), 1)])}
        />
      }
    >
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label="Line chart of churn rate by three-year age band"
          onMouseMove={(e) => {
            const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
            let best = 0;
            pts.forEach((p, i) => Math.abs(p[0] - px) < Math.abs(pts[best][0] - px) && (best = i));
            setHover(best);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} className="stroke-viz-grid" />
              <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-soft text-[11px] tabular-nums">
                {pct(v)}
              </text>
            </g>
          ))}
          <line x1={m.l} x2={width - m.r} y1={y(overall)} y2={y(overall)} stroke="var(--ink)" strokeOpacity={0.45} />
          <text x={width - m.r} y={y(overall) - 6} textAnchor="end" className="fill-ink-soft text-[11px]">
            overall {pct(overall)}
          </text>
          <path
            d={`M${pts.map((p) => p.join(",")).join("L")}L${pts[pts.length - 1][0]},${y(0)}L${pts[0][0]},${y(0)}Z`}
            fill="var(--viz-churn)"
            opacity={0.1}
          />
          <path
            d={`M${pts.map((p) => p.join(",")).join("L")}`}
            fill="none"
            stroke="var(--viz-churn)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {data.map((b, i) =>
            i % 3 === 0 ? (
              <text key={b.lo} x={x(b.lo)} y={H - m.b + 16} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                {b.lo}
              </text>
            ) : null,
          )}
          <line x1={m.l} x2={width - m.r} y1={y(0)} y2={y(0)} stroke="var(--viz-axis)" />
          <text x={(m.l + width - m.r) / 2} y={H - 4} textAnchor="middle" className="fill-ink-soft text-[12px]">
            Age
          </text>
          {hover !== null && (
            <g>
              <line x1={pts[hover][0]} x2={pts[hover][0]} y1={m.t} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.25} />
              <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} fill="var(--viz-churn)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hb && hover !== null && (
          <Tooltip
            width={width}
            tip={{
              x: pts[hover][0],
              y: pts[hover][1],
              content: (
                <>
                  <p className="mb-1 font-semibold">
                    Age {hb.lo}-{hb.hi - 1}
                  </p>
                  <TipRow label="Churn rate" value={pct(rate(hb), 1)} />
                  <TipRow label="Customers" value={int(hb.stayed + hb.churned)} />
                </>
              ),
            }}
          />
        )}
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------- leakage scan */

type LeakRow = { feature: string; label: string; single_feature_auc: number; dropped: boolean };

export function LeakageChart({ rows }: { rows: LeakRow[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const shown = rows.slice(0, 8);
  const labelW = 132;
  const rowH = 28;
  const barH = 14;
  const x = linear([0.5, 1], [labelW, width - 44]);
  const H = shown.length * rowH + 30;
  return (
    <Figure
      title="How well each column predicts churn on its own"
      takeaway="ROC-AUC of each column alone. 0.5 is a coin flip; 1.0 is a perfect answer key."
      legend={
        <ul className="flex flex-wrap gap-x-5 text-[0.8rem] text-ink-soft">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px] bg-viz-churn" /> Dropped: leaks the label
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px] bg-viz-ref" /> Kept
          </li>
        </ul>
      }
      table={
        <DataTable
          head={["Column", "Single-column ROC-AUC", "Used by model"]}
          rows={rows.map((r) => [r.label, r.single_feature_auc.toFixed(3), r.dropped ? "No (leak)" : "Yes"])}
        />
      }
    >
      <div ref={ref}>
        <svg width={width} height={H} role="img" aria-label="Bar chart of single-column ROC-AUC; Complain scores near 1.0">
          {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={0} y2={H - 22} className="stroke-viz-grid" />
              <text x={x(v)} y={H - 6} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {shown.map((r, i) => {
            const y = i * rowH + 6;
            return (
              <g key={r.feature}>
                <text
                  x={labelW - 10}
                  y={y + barH / 2 + 4}
                  textAnchor="end"
                  className={`text-[12px] ${r.dropped ? "fill-ink font-semibold" : "fill-ink"}`}
                >
                  {r.label}
                </text>
                <path d={hBarPath(labelW, x(r.single_feature_auc), y, barH)} fill={r.dropped ? "var(--viz-churn)" : "var(--viz-ref)"} />
                <text x={x(r.single_feature_auc) + 6} y={y + barH / 2 + 4} className="fill-ink-soft text-[11px] tabular-nums">
                  {r.single_feature_auc.toFixed(2)}
                </text>
              </g>
            );
          })}
          <line x1={labelW} x2={labelW} y1={0} y2={H - 22} stroke="var(--viz-axis)" />
        </svg>
      </div>
    </Figure>
  );
}
