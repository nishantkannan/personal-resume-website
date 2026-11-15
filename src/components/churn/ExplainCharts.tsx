"use client";

import { useState } from "react";
import type { Example, FairnessRow } from "@/lib/churn-report";
import {
  DataTable,
  Figure,
  Legend,
  Segmented,
  TipRow,
  Tooltip,
  XAxis,
  hBarPath,
  linear,
  num,
  pct,
  ticks,
  useWidth,
  type Tip,
} from "./primitives";

/* --------------------------------------------------------------- helpers */

const PROB_TICKS = [0.01, 0.05, 0.2, 0.5, 0.8, 0.95, 0.99];
const ODDS_TICKS = [1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16];
const sigmoid = (v: number) => 1 / (1 + Math.exp(-v));
const logit = (p: number) => Math.log(p / (1 - p));
/** Axis label for a log-odds value, as a clean multiplier: ×4, ×1, ×1/2. */
function oddsTick(logOdds: number) {
  const f = Math.exp(logOdds);
  return f >= 1 ? `×${Math.round(f)}` : `×1/${Math.round(1 / f)}`;
}
function oddsFactor(logOdds: number) {
  const f = Math.exp(logOdds);
  if (f >= 0.995) return f >= 10 ? f.toFixed(0) : f.toFixed(1);
  return f.toFixed(2).replace(/^0/, "0");
}

/* ------------------------------------------------------ feature importance */

type ShapImp = { feature: string; label: string; mean_abs_shap: number };
type PermImp = { feature: string; label: string; mean: number; std: number };

export function ImportanceChart({ shap, permutation, units }: { shap: ShapImp[]; permutation: PermImp[]; units: string }) {
  const [kind, setKind] = useState<"shap" | "perm">("perm");
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const rows =
    kind === "shap"
      ? shap.map((s) => ({ label: s.label, v: s.mean_abs_shap, err: 0 }))
      : permutation.map((p) => ({ label: p.label, v: Math.max(0, p.mean), err: p.std }));
  const labelW = 130;
  const rowH = 26;
  const barH = 13;
  const max = Math.max(...rows.map((r) => r.v + r.err));
  const x = linear([0, max * 1.08], [labelW, width - 48]);
  const H = rows.length * rowH + 34;
  const fmt = (v: number) => (kind === "perm" ? num(v, 3) : units === "probability" ? `${num(v * 100, 1)} pts` : num(v, 2));

  return (
    <Figure
      title="What the model relies on"
      takeaway={
        kind === "perm"
          ? "Permutation importance: shuffle one column on the test set and measure how much ROC-AUC drops. Whiskers show ±1 sd over 15 shuffles."
          : `SHAP: the average size of each feature's push on a customer's predicted ${units === "probability" ? "probability, in percentage points" : "churn log-odds (1.0 ≈ multiplying the odds by 2.7)"}.`
      }
      controls={
        <Segmented
          label="Importance method"
          value={kind}
          onChange={setKind}
          options={[
            { value: "perm", label: "Permutation" },
            { value: "shap", label: "SHAP" },
          ]}
        />
      }
      table={<DataTable head={["Feature", kind === "perm" ? "ROC-AUC drop" : "Mean |SHAP|"]} rows={rows.map((r) => [r.label, fmt(r.v)])} />}
    >
      <div ref={ref}>
        <svg width={width} height={H} role="img" aria-label="Feature importance bar chart">
          <XAxis
            scale={x}
            y={H - 24}
            values={ticks(0, max * 1.08, 4)}
            format={(v) => (kind === "perm" ? num(v, 2) : units === "probability" ? num(v * 100, 0) : num(v, 2))}
            grid={0}
          />
          {rows.map((r, i) => {
            const y = i * rowH + 4;
            return (
              <g key={r.label}>
                <text x={labelW - 10} y={y + barH / 2 + 4} textAnchor="end" className="fill-ink text-[12px]">
                  {r.label}
                </text>
                <path d={hBarPath(labelW, x(r.v), y, barH)} fill={i < 2 ? "var(--viz-model)" : "var(--viz-ref)"} />
                {r.err > 0 && (
                  <line
                    x1={x(Math.max(0, r.v - r.err))}
                    x2={x(r.v + r.err)}
                    y1={y + barH / 2}
                    y2={y + barH / 2}
                    stroke="var(--ink)"
                    strokeOpacity={0.55}
                  />
                )}
                <text x={x(r.v + r.err) + 6} y={y + barH / 2 + 4} className="fill-ink-soft text-[11px] tabular-nums">
                  {fmt(r.v)}
                </text>
              </g>
            );
          })}
          <line x1={labelW} x2={labelW} y1={0} y2={H - 24} stroke="var(--viz-axis)" />
        </svg>
      </div>
    </Figure>
  );
}

/* ------------------------------------------------------- SHAP dependence */

type Dep = { label: string; categorical: boolean; points: (string | number)[][] };

export function DependencePlot({ dependence, units }: { dependence: Record<string, Dep>; units: string }) {
  const keys = Object.keys(dependence);
  const [feature, setFeature] = useState(keys[0]);
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const [tip, setTip] = useState<Tip>(null);
  const dep = dependence[feature];
  const m = { l: 70, r: 14, t: 12, b: 44 };
  const H = 280;
  const ys = dep.points.map((p) => Number(p[1]));
  const yMax = Math.max(...ys.map(Math.abs)) * 1.1;
  const y = linear([-yMax, yMax], [H - m.b, m.t]);
  const scaleY = (v: number) => (units === "probability" ? v * 100 : v);
  const yFmt = (v: number) => (units === "probability" ? `${scaleY(v) > 0 ? "+" : ""}${num(scaleY(v), 0)}` : oddsTick(v));
  const yTicks = units === "probability" ? ticks(-yMax, yMax, 4) : ODDS_TICKS.map(Math.log).filter((v) => Math.abs(v) <= yMax);

  // Categorical features: a strip per category, jittered deterministically.
  const cats = dep.categorical ? [...new Set(dep.points.map((p) => String(p[0])))].sort() : [];
  const numVals = dep.categorical ? [] : dep.points.map((p) => Number(p[0]));
  const xMin = dep.categorical ? 0 : Math.min(...numVals);
  const xMax = dep.categorical ? cats.length : Math.max(...numVals);
  const x = linear([xMin, xMax], [m.l + 6, width - m.r]);
  const band = (width - m.r - m.l) / Math.max(1, cats.length);
  const px = (p: (string | number)[], i: number) =>
    dep.categorical ? m.l + band * (cats.indexOf(String(p[0])) + 0.5) + (((i * 7919) % 100) / 100 - 0.5) * band * 0.5 : x(Number(p[0]));
  const catLabel = (c: string) => (feature === "IsActiveMember" ? (c === "1" ? "Active" : "Inactive") : c);

  return (
    <Figure
      title="How one feature moves the prediction"
      takeaway={`Each dot is a test customer. Above the line, this feature raised their churn risk; below it, lowered it${units === "probability" ? " (in percentage points)" : ". The scale shows how much it multiplied the odds of leaving"}.`}
      controls={
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-soft">
          Feature
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="rounded-lg border border-line bg-bg/60 px-2 py-1 text-[0.85rem] text-ink focus:border-contour"
          >
            {keys.map((k) => (
              <option key={k} value={k}>
                {dependence[k].label}
              </option>
            ))}
          </select>
        </label>
      }
      legend={
        <Legend
          items={[
            { color: "var(--viz-churn)", label: "Raises risk" },
            { color: "var(--viz-model)", label: "Lowers risk" },
          ]}
        />
      }
    >
      <div ref={ref} className="relative">
        <svg width={width} height={H} role="img" aria-label={`SHAP dependence plot for ${dep.label}`}>
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={m.l}
                x2={width - m.r}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? "" : "stroke-viz-grid"}
                stroke={v === 0 ? "var(--ink)" : undefined}
                strokeOpacity={v === 0 ? 0.45 : undefined}
              />
              <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-soft text-[11px] tabular-nums">
                {yFmt(v)}
              </text>
            </g>
          ))}
          <text transform={`translate(12 ${(H - m.b + m.t) / 2}) rotate(-90)`} textAnchor="middle" className="fill-ink-soft text-[12px]">
            {units === "probability" ? "Effect on churn probability (pts)" : "Effect on odds of churning"}
          </text>
          {dep.points.map((p, i) => {
            const v = Number(p[1]);
            return (
              <circle
                key={i}
                cx={px(p, i)}
                cy={y(v)}
                r={3}
                fill={v >= 0 ? "var(--viz-churn)" : "var(--viz-model)"}
                opacity={0.55}
                onMouseEnter={() =>
                  setTip({
                    x: px(p, i),
                    y: y(v),
                    content: (
                      <>
                        <TipRow label={dep.label} value={dep.categorical ? catLabel(String(p[0])) : Number(p[0]).toLocaleString("en-US")} />
                        <TipRow
                          label="Effect"
                          value={units === "probability" ? `${v > 0 ? "+" : ""}${num(v * 100, 1)} pts` : `×${oddsFactor(v)} odds`}
                        />
                      </>
                    ),
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
            );
          })}
          {dep.categorical
            ? cats.map((c, i) => (
                <text key={c} x={m.l + band * (i + 0.5)} y={H - m.b + 18} textAnchor="middle" className="fill-ink-soft text-[11px]">
                  {catLabel(c)}
                </text>
              ))
            : ticks(xMin, xMax, 5).map((v) => (
                <text key={v} x={x(v)} y={H - m.b + 18} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                  {v >= 10000 ? `${Math.round(v / 1000)}K` : v}
                </text>
              ))}
          <text x={(m.l + width - m.r) / 2} y={H - 6} textAnchor="middle" className="fill-ink-soft text-[12px]">
            {dep.label}
          </text>
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </Figure>
  );
}

/* --------------------------------------------- one customer, explained */

export function Waterfall({ examples, units }: { examples: Example[]; units: string }) {
  const [idx, setIdx] = useState(0);
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const ex = examples[idx];
  const isProb = units === "probability";
  const steps = [
    ...ex.contributions.map((c) => ({ label: c.label, value: c.value, d: c.shap })),
    ...(Math.abs(ex.other_shap) > 1e-4 ? [{ label: `${ex.other_count} other features`, value: "", d: ex.other_shap }] : []),
  ];
  let run = ex.base_value;
  const bars = steps.map((s) => {
    const from = run;
    run += s.d;
    return { ...s, from, to: run };
  });
  const end = run;
  const lo = isProb ? 0 : Math.min(logit(0.01), ...bars.map((b) => Math.min(b.from, b.to)), ex.base_value) - 0.2;
  const hi = isProb ? Math.max(1, ...bars.map((b) => b.to)) : Math.max(logit(0.99), ...bars.map((b) => Math.max(b.from, b.to))) + 0.2;
  const labelW = Math.min(190, width * 0.42);
  const x = linear([lo, hi], [labelW, width - 56]);
  const rowH = 30;
  const barH = 16;
  const H = (bars.length + 2) * rowH + 30;
  // Log-odds add up cleanly but read poorly, so steps are shown as odds multipliers
  // and the axis is labelled in probabilities (a logit scale).
  const fmtD = (d: number) => (isProb ? `${d > 0 ? "+" : "−"}${num(Math.abs(d) * 100, 1)} pts` : `×${oddsFactor(d)} odds`);
  const fmtV = (v: number) => (isProb ? pct(v, 0) : pct(sigmoid(v), sigmoid(v) < 0.1 ? 1 : 0));
  const probTicks = width < 520 ? [0.05, 0.5, 0.95] : PROB_TICKS;
  const axisTicks = isProb ? ticks(lo, hi, width < 520 ? 3 : 5) : probTicks.map(logit).filter((v) => v >= lo && v <= hi);

  return (
    <Figure
      title="One customer, explained"
      takeaway={
        <>
          Starts at the average prediction ({fmtV(ex.base_value)}) and applies each feature&rsquo;s push
          {isProb ? "" : ", shown as how much it multiplies the odds of leaving,"} to reach this customer&rsquo;s score of{" "}
          <strong className="font-semibold text-ink">{pct(ex.probability)}</strong>. This customer {ex.churned ? "did leave" : "stayed"}.
        </>
      }
      controls={
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-soft">
          Customer
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="rounded-lg border border-line bg-bg/60 px-2 py-1 text-[0.85rem] text-ink focus:border-contour"
          >
            {examples.map((e, i) => (
              <option key={e.title} value={i}>
                {e.title} ({pct(e.probability)})
              </option>
            ))}
          </select>
        </label>
      }
      legend={
        <Legend
          items={[
            { color: "var(--viz-churn)", label: "Raises risk" },
            { color: "var(--viz-model)", label: "Lowers risk" },
          ]}
        />
      }
      table={
        <DataTable
          head={["Feature", "Value", isProb ? "Effect (pts)" : "Effect on odds"]}
          rows={[
            ["Average prediction", "", fmtV(ex.base_value)],
            ...steps.map((s) => [s.label, s.value, fmtD(s.d)]),
            ["This customer", "", pct(ex.probability, 1)],
          ]}
        />
      }
    >
      <div ref={ref}>
        <svg width={width} height={H} role="img" aria-label={`Waterfall of feature effects for the ${ex.title.toLowerCase()} customer`}>
          {axisTicks.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={0} y2={H - 22} className="stroke-viz-grid" />
              <text x={x(v)} y={H - 6} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                {fmtV(v)}
              </text>
            </g>
          ))}
          {row(4, "Average prediction", "")}
          <line
            x1={x(ex.base_value)}
            x2={x(ex.base_value)}
            y1={4}
            y2={4 + rowH * (bars.length + 1)}
            stroke="var(--ink)"
            strokeOpacity={0.3}
          />
          <circle cx={x(ex.base_value)} cy={4 + barH / 2} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          <text x={x(ex.base_value) + 10} y={4 + barH / 2 + 4} className="fill-ink-soft text-[11px] tabular-nums">
            {fmtV(ex.base_value)}
          </text>
          {bars.map((b, i) => {
            const y = 4 + (i + 1) * rowH;
            const x0 = x(Math.min(b.from, b.to));
            const x1 = x(Math.max(b.from, b.to));
            const up = b.d >= 0;
            return (
              <g key={b.label}>
                {row(y, b.label, b.value)}
                <rect
                  x={x0}
                  y={y}
                  width={Math.max(1.5, x1 - x0)}
                  height={barH}
                  rx={3}
                  fill={up ? "var(--viz-churn)" : "var(--viz-model)"}
                />
                <text
                  x={up ? x1 + 6 : x0 - 6}
                  y={y + barH / 2 + 4}
                  textAnchor={up ? "start" : "end"}
                  className="fill-ink-soft text-[11px] tabular-nums"
                >
                  {fmtD(b.d)}
                </text>
              </g>
            );
          })}
          {(() => {
            const y = 4 + (bars.length + 1) * rowH;
            return (
              <g>
                {row(y, "This customer", "", true)}
                <circle cx={x(end)} cy={y + barH / 2} r={6} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
                <text
                  x={x(end) + (x(end) > width - 90 ? -10 : 10)}
                  y={y + barH / 2 + 4}
                  textAnchor={x(end) > width - 90 ? "end" : "start"}
                  className="fill-ink text-[12px] font-semibold tabular-nums"
                >
                  {pct(ex.probability)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </Figure>
  );

  function row(y: number, label: string, sub: string, bold?: boolean) {
    return (
      <text x={0} y={y + barH / 2 + 4} className={`text-[12px] ${bold ? "fill-ink font-semibold" : "fill-ink"}`}>
        {label}
        {sub && <tspan className="fill-ink-soft">{`  ${sub}`}</tspan>}
      </text>
    );
  }
}

/* ------------------------------------------------------------- fairness */

export function FairnessChart({ groups }: { groups: { key: string; title: string; rows: FairnessRow[] }[] }) {
  const [metric, setMetric] = useState<"recall" | "roc_auc" | "calibration">("recall");
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const [tip, setTip] = useState<Tip>(null);
  const labelW = 120;
  const rowH = 30;
  const head = 26;
  const items = groups.flatMap((g) => [{ header: g.title } as const, ...g.rows.map((r) => ({ row: r }))]);
  const tops = items.map((_, i) => items.slice(0, i).reduce((h, f) => h + ("header" in f ? head : rowH), 0));
  const flat = items.map((f, i) => ({ ...f, top: tops[i] }));
  const H = items.reduce((h, f) => h + ("header" in f ? head : rowH), 0) + 34;
  const domain: [number, number] = metric === "roc_auc" ? [0.6, 1] : [0, 1];
  const x = linear(domain, [labelW, width - 60]);

  return (
    <Figure
      title="Does it work equally well for every group?"
      takeaway={
        metric === "recall"
          ? "Share of each group's churners the model flags at the default cut-off."
          : metric === "roc_auc"
            ? "How well the model ranks churners above stayers within each group."
            : "Average predicted risk (dot) against the group's real churn rate (ring). Close together means the scores aren't biased for that group."
      }
      controls={
        <Segmented
          label="Fairness metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "recall", label: "Recall" },
            { value: "roc_auc", label: "ROC-AUC" },
            { value: "calibration", label: "Calibration" },
          ]}
        />
      }
      legend={
        metric === "calibration" ? (
          <ul className="flex flex-wrap gap-x-5 text-[0.8rem] text-ink-soft">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-full bg-viz-model" /> Predicted
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-full border-2 border-ink" /> Actual
            </li>
          </ul>
        ) : undefined
      }
      table={
        <DataTable
          head={["Group", "Test customers", "Churn rate", "Mean predicted", "Recall", "Precision", "ROC-AUC"]}
          rows={groups.flatMap((g) =>
            g.rows.map((r) => [
              `${g.title}: ${r.group}`,
              r.n,
              pct(r.churn_rate, 1),
              pct(r.mean_predicted, 1),
              r.recall === null ? "–" : pct(r.recall, 1),
              r.precision === null ? "–" : pct(r.precision, 1),
              r.roc_auc === null ? "–" : num(r.roc_auc, 3),
            ]),
          )}
        />
      }
    >
      <div ref={ref} className="relative">
        <svg width={width} height={H} role="img" aria-label="Model performance by country, gender and age group">
          {ticks(domain[0], domain[1], 5).map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={0} y2={H - 26} className="stroke-viz-grid" />
              <text x={x(v)} y={H - 8} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                {metric === "roc_auc" ? num(v, 1) : pct(v)}
              </text>
            </g>
          ))}
          {flat.map((f, i) => {
            if ("header" in f) {
              return (
                <text key={`h${i}`} x={0} y={f.top + 17} className="fill-ink-soft text-[11px] font-semibold uppercase tracking-[0.06em]">
                  {f.header}
                </text>
              );
            }
            const r = f.row;
            const cy = f.top + rowH / 2;
            const v = metric === "recall" ? r.recall : metric === "roc_auc" ? r.roc_auc : r.mean_predicted;
            if (v === null) return null;
            return (
              <g
                key={`r${i}`}
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({
                    x: e.clientX - box.left,
                    y: cy,
                    content: (
                      <>
                        <p className="mb-1 font-semibold">{r.group}</p>
                        <TipRow label="Test customers" value={r.n} />
                        <TipRow label="Actual churn" value={pct(r.churn_rate, 1)} />
                        <TipRow label="Mean predicted" value={pct(r.mean_predicted, 1)} />
                        {r.recall !== null && <TipRow label="Recall" value={pct(r.recall, 1)} />}
                        {r.roc_auc !== null && <TipRow label="ROC-AUC" value={num(r.roc_auc, 3)} />}
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setTip(null)}
              >
                <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill="transparent" />
                <text x={12} y={cy + 4} className="fill-ink text-[12px]">
                  {r.group}
                </text>
                {metric === "calibration" ? (
                  <>
                    <line
                      x1={x(r.churn_rate)}
                      x2={x(r.mean_predicted)}
                      y1={cy}
                      y2={cy}
                      stroke="var(--ink)"
                      strokeOpacity={0.35}
                      strokeWidth={2}
                    />
                    <circle cx={x(r.churn_rate)} cy={cy} r={5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
                    <circle cx={x(r.mean_predicted)} cy={cy} r={5} fill="var(--viz-model)" stroke="var(--surface)" strokeWidth={2} />
                  </>
                ) : metric === "roc_auc" ? (
                  <>
                    {/* A dot, not a bar: this axis does not start at zero. */}
                    <circle cx={x(v)} cy={cy} r={5} fill="var(--viz-model)" stroke="var(--surface)" strokeWidth={2} />
                    <text x={x(v) + 10} y={cy + 4} className="fill-ink-soft text-[11px] tabular-nums">
                      {num(v, 2)}
                    </text>
                  </>
                ) : (
                  <>
                    <path d={hBarPath(labelW, x(v), cy - 7, 14)} fill="var(--viz-model)" />
                    <text x={x(v) + 6} y={cy + 4} className="fill-ink-soft text-[11px] tabular-nums">
                      {pct(v)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <line x1={labelW} x2={labelW} y1={0} y2={H - 26} stroke="var(--viz-axis)" />
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </Figure>
  );
}
