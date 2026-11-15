"use client";

import { useId, useMemo, useState } from "react";
import type { SweepRow } from "@/lib/churn-report";
import { Figure, Legend, TipRow, Tooltip, int, linear, pct, vBarPath, useWidth, type Tip } from "./primitives";

type HistBin = { lo: number; hi: number; stayed: number; churned: number };

/**
 * Move the cut-off and see what happens to the flagged list. The economics panel turns
 * the confusion matrix into money with assumptions the reader controls.
 */
export function ThresholdExplorer({
  sweep,
  histogram,
  chosen,
  testRows,
}: {
  sweep: SweepRow[];
  histogram: HistBin[];
  chosen: number;
  testRows: number;
}) {
  const [t, setT] = useState(chosen);
  const [offerCost, setOfferCost] = useState(50);
  const [customerValue, setCustomerValue] = useState(1000);
  const [saveRate, setSaveRate] = useState(0.3);
  const id = useId();

  const row = sweep.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  const flagged = row.tp + row.fp;
  const precision = flagged ? row.tp / flagged : 0;
  const recall = row.tp / (row.tp + row.fn);
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  const value = (r: SweepRow) => r.tp * saveRate * customerValue - (r.tp + r.fp) * offerCost;
  const net = value(row);
  const best = useMemo(() => sweep.reduce((a, b) => (value(b) > value(a) ? b : a)), [sweep, offerCost, customerValue, saveRate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.35fr_1fr]">
      <Figure
        title="Where the cut-off falls"
        takeaway="Test customers by predicted churn probability. Everyone to the right of the line gets flagged for the retention team."
        legend={
          <Legend
            items={[
              { color: "var(--viz-model)", label: "Stayed (above the line)" },
              { color: "var(--viz-churn)", label: "Churned (below)" },
            ]}
          />
        }
      >
        <ScoreHistogram bins={histogram} t={row.t} chosen={chosen} />
        <div className="mt-4">
          <label htmlFor={`${id}-t`} className="flex items-baseline justify-between text-[0.9rem]">
            <span className="font-semibold">Flag customers scoring at least</span>
            <span className="text-lg font-semibold tabular-nums">{pct(row.t)}</span>
          </label>
          <input
            id={`${id}-t`}
            type="range"
            min={0.02}
            max={0.98}
            step={0.01}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--viz-model)]"
          />
          <div className="mt-1 flex flex-wrap gap-2 text-[0.8rem]">
            <button
              type="button"
              onClick={() => setT(chosen)}
              className="rounded-full border border-line px-3 py-1 hover:border-contour hover:text-contour"
            >
              Model default ({pct(chosen)}, best F1 on training folds)
            </button>
            <button
              type="button"
              onClick={() => setT(best.t)}
              className="rounded-full border border-line px-3 py-1 hover:border-contour hover:text-contour"
            >
              Most profitable for the costs below ({pct(best.t)})
            </button>
          </div>
        </div>
      </Figure>

      <div className="flex min-w-0 flex-col gap-4">
        <figure className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <figcaption className="font-semibold">
            At {pct(row.t)}: {int(flagged)} of {int(testRows)} customers flagged
          </figcaption>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Precision" value={pct(precision)} hint="of flagged customers do churn" />
            <Stat label="Recall" value={pct(recall)} hint="of churners get flagged" />
            <Stat label="F1" value={f1.toFixed(2)} hint="balance of the two" />
          </dl>
          <ConfusionMatrix row={row} />
        </figure>

        <figure className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <figcaption className="font-semibold">What it&rsquo;s worth (your assumptions)</figcaption>
          <div className="mt-3 grid grid-cols-3 gap-3 text-[0.8rem]">
            <NumberField id={`${id}-cost`} label="Offer cost" prefix="$" value={offerCost} step={10} onChange={setOfferCost} />
            <NumberField
              id={`${id}-value`}
              label="Customer value"
              prefix="$"
              value={customerValue}
              step={100}
              onChange={setCustomerValue}
            />
            <NumberField
              id={`${id}-save`}
              label="Offers that save"
              suffix="%"
              value={Math.round(saveRate * 100)}
              step={5}
              onChange={(v) => setSaveRate(Math.min(100, Math.max(0, v)) / 100)}
            />
          </div>
          <p className="mt-4 text-[0.9rem] text-ink-soft">Net value on these {int(testRows)} test customers</p>
          <p className={`text-[2rem] font-semibold leading-tight ${net < 0 ? "text-viz-churn" : ""}`}>
            {net < 0 ? "−" : ""}${int(Math.abs(Math.round(net)))}
          </p>
          <p className="mt-1 text-[0.8rem] leading-snug text-ink-soft">
            {int(row.tp)} churners reached × {pct(saveRate)} saved × ${int(customerValue)}, minus {int(flagged)} offers × ${int(offerCost)}.
            {best.t !== row.t && (
              <>
                {" "}
                The best cut-off for these numbers is {pct(best.t)} (${int(Math.round(value(best)))}).
              </>
            )}
          </p>
        </figure>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-[0.8rem] text-ink-soft">{label}</dt>
      <dd className="text-[1.5rem] font-semibold leading-tight">{value}</dd>
      <dd className="text-[0.75rem] leading-snug text-ink-soft">{hint}</dd>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  step,
  prefix,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-ink-soft">
        {label}
      </label>
      <div className="mt-1 flex items-center rounded-lg border border-line bg-bg/60 px-2 focus-within:border-contour">
        {prefix && <span className="text-ink-soft">{prefix}</span>}
        <input
          id={id}
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full min-w-0 bg-transparent py-1.5 pl-1 text-[0.95rem] tabular-nums outline-none"
        />
        {suffix && <span className="text-ink-soft">{suffix}</span>}
      </div>
    </div>
  );
}

function ConfusionMatrix({ row }: { row: SweepRow }) {
  const cells = [
    { k: "tp", label: "Flagged, did churn", sub: "caught", v: row.tp, strong: true },
    { k: "fn", label: "Not flagged, did churn", sub: "missed", v: row.fn, strong: false },
    { k: "fp", label: "Flagged, stayed", sub: "wasted offer", v: row.fp, strong: false },
    { k: "tn", label: "Not flagged, stayed", sub: "correctly left alone", v: row.tn, strong: false },
  ];
  return (
    <div
      className="mt-4 grid grid-cols-2 gap-[2px] overflow-hidden rounded-xl border border-line bg-line text-[0.8rem]"
      role="table"
      aria-label="Confusion matrix"
    >
      {cells.map((c) => (
        <div
          key={c.k}
          role="cell"
          className={`bg-surface p-3 ${c.strong ? "bg-[color-mix(in_srgb,var(--viz-model)_12%,var(--surface))]" : ""}`}
        >
          <p className="text-[1.25rem] font-semibold tabular-nums leading-tight">{int(c.v)}</p>
          <p className="leading-snug">{c.label}</p>
          <p className="text-ink-soft">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

function ScoreHistogram({ bins, t, chosen }: { bins: HistBin[]; t: number; chosen: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const [tip, setTip] = useState<Tip>(null);
  const m = { l: 44, r: 22, t: 14, b: 34 };
  const H = 260;
  const x = linear([0, 1], [m.l, width - m.r]);
  // Stayed customers point up from the middle line, churners point down. Both use the
  // same square-root scale: the lowest-score bins hold hundreds of customers, the
  // highest a few dozen, and a linear scale would flatten everything but the first bars.
  const mid = m.t + (H - m.t - m.b) * 0.58;
  const maxCount = Math.max(...bins.flatMap((b) => [b.stayed, b.churned]));
  const k = (mid - m.t) / Math.sqrt(maxCount);
  const up = (v: number) => mid - Math.sqrt(v) * k;
  const down = (v: number) => Math.min(H - m.b, mid + Math.sqrt(v) * k);
  const tickVals = [10, 100, 400].filter((v) => v <= maxCount);
  const bw = Math.max(2, x(bins[0].hi) - x(bins[0].lo) - 2);

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Histogram of predicted churn probability: customers who stayed above the line, churners below"
      >
        {tickVals.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={width - m.r} y1={up(v)} y2={up(v)} className="stroke-viz-grid" />
            <text x={m.l - 6} y={up(v) + 4} textAnchor="end" className="fill-ink-soft text-[11px] tabular-nums">
              {v}
            </text>
            {down(v) < H - m.b && (
              <>
                <line x1={m.l} x2={width - m.r} y1={down(v)} y2={down(v)} className="stroke-viz-grid" />
                <text x={m.l - 6} y={down(v) + 4} textAnchor="end" className="fill-ink-soft text-[11px] tabular-nums">
                  {v}
                </text>
              </>
            )}
          </g>
        ))}
        <text x={m.l + 4} y={m.t + 2} className="fill-ink-soft text-[11px]">
          ↑ stayed
        </text>
        <text x={m.l + 4} y={H - m.b - 4} className="fill-ink-soft text-[11px]">
          ↓ churned
        </text>
        {bins.map((b) => {
          const x0 = x(b.lo) + 1;
          const dim = b.hi <= t + 1e-9;
          return (
            <g
              key={b.lo}
              opacity={dim ? 0.4 : 1}
              onMouseMove={(e) => {
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  content: (
                    <>
                      <p className="mb-1 font-semibold">
                        Score {pct(b.lo)}–{pct(b.hi)}
                      </p>
                      <TipRow swatch="var(--viz-model)" label="Stayed" value={int(b.stayed)} />
                      <TipRow swatch="var(--viz-churn)" label="Churned" value={int(b.churned)} />
                    </>
                  ),
                });
              }}
              onMouseLeave={() => setTip(null)}
            >
              <rect x={x0} y={m.t} width={bw} height={H - m.b - m.t} fill="transparent" />
              {b.stayed > 0 && <path d={vBarPath(x0, bw, up(b.stayed), mid - 1, 3)} fill="var(--viz-model)" />}
              {b.churned > 0 && <path d={flipDown(x0, bw, mid + 1, down(b.churned))} fill="var(--viz-churn)" />}
            </g>
          );
        })}
        <line x1={m.l} x2={width - m.r} y1={mid} y2={mid} stroke="var(--viz-axis)" />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={x(v)} y={H - m.b + 16} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
            {pct(v)}
          </text>
        ))}
        <text x={(m.l + width - m.r) / 2} y={H - 2} textAnchor="middle" className="fill-ink-soft text-[12px]">
          Predicted churn probability (counts on a square-root scale)
        </text>
        {Math.abs(chosen - t) > 0.001 && (
          <line x1={x(chosen)} x2={x(chosen)} y1={m.t} y2={H - m.b} stroke="var(--ink)" strokeOpacity={0.3} />
        )}
        <line x1={x(t)} x2={x(t)} y1={m.t - 6} y2={H - m.b} stroke="var(--ink)" strokeWidth={2} />
        <text
          x={x(t) + (x(t) > width - 90 ? -6 : 6)}
          y={m.t + 2}
          textAnchor={x(t) > width - 90 ? "end" : "start"}
          className="fill-ink text-[11px] font-semibold"
        >
          {x(t) > width - 90 ? "← flagged" : "flagged →"}
        </text>
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/** A column hanging down from the baseline: square at the top, rounded at the bottom. */
function flipDown(x: number, w: number, yBase: number, yEnd: number, r = 3) {
  const h = yEnd - yBase;
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${yBase}V${yEnd - rr}Q${x},${yEnd} ${x + rr},${yEnd}H${x + w - rr}Q${x + w},${yEnd} ${x + w},${yEnd - rr}V${yBase}Z`;
}
