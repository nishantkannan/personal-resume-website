"use client";

import { useState } from "react";
import {
  DataTable,
  Figure,
  Legend,
  Segmented,
  TipRow,
  Tooltip,
  XAxis,
  YAxis,
  linear,
  num,
  pct,
  ticks,
  useWidth,
  type Tip,
} from "./primitives";

/* ----------------------------------------------------- model comparison */

type Stat = { mean: number; std: number; folds: number[] };
type Candidate = { key: string; short: string; label: string; roc_auc: Stat; pr_auc: Stat; brier: Stat; log_loss: Stat };
type Metric = "pr_auc" | "roc_auc";

const METRIC_NAME: Record<Metric, string> = { pr_auc: "PR-AUC", roc_auc: "ROC-AUC" };

/** Dot plot: each fold's score as a small dot, the mean as a large one, ±1 sd as a rule. */
export function ModelComparison({ candidates, selected }: { candidates: Candidate[]; selected: string }) {
  const [metric, setMetric] = useState<Metric>("pr_auc");
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const [tip, setTip] = useState<Tip>(null);
  const labelW = 112;
  const rowH = 44;
  const m = { r: 16, t: 8, b: 40 };
  const all = candidates.flatMap((c) => c[metric].folds);
  const lo = Math.floor(Math.min(...all) * 10) / 10;
  const x = linear([lo, 1], [labelW, width - m.r]);
  const H = candidates.length * rowH + m.t + m.b;

  return (
    <Figure
      title="Candidate models, scored by nested cross-validation"
      takeaway="Five outer folds on the training set. Each model is tuned inside every fold, so no score comes from data the model was tuned on."
      controls={
        <Segmented
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "pr_auc", label: "PR-AUC" },
            { value: "roc_auc", label: "ROC-AUC" },
          ]}
        />
      }
      legend={
        <Legend
          items={[
            { color: "var(--viz-model)", label: "Selected model" },
            { color: "var(--viz-ref)", label: "Other candidates" },
          ]}
        />
      }
      table={
        <DataTable
          head={["Model", "PR-AUC", "ROC-AUC", "Brier", "Log loss"]}
          rows={candidates.map((c) => [
            c.label,
            `${num(c.pr_auc.mean, 3)} ± ${num(c.pr_auc.std, 3)}`,
            `${num(c.roc_auc.mean, 3)} ± ${num(c.roc_auc.std, 3)}`,
            num(c.brier.mean, 3),
            num(c.log_loss.mean, 3),
          ])}
        />
      }
    >
      <div ref={ref} className="relative">
        <svg width={width} height={H} role="img" aria-label={`${METRIC_NAME[metric]} of each candidate model across five folds`}>
          <XAxis
            scale={x}
            y={H - m.b}
            values={ticks(lo, 1, 5)}
            format={(v) => v.toFixed(1)}
            label={`${METRIC_NAME[metric]} (higher is better)`}
            grid={m.t}
          />
          {candidates.map((c, i) => {
            const cy = m.t + i * rowH + rowH / 2;
            const s = c[metric];
            const color = c.key === selected ? "var(--viz-model)" : "var(--viz-ref)";
            return (
              <g
                key={c.key}
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({
                    x: e.clientX - box.left,
                    y: cy,
                    content: (
                      <>
                        <p className="mb-1 font-semibold">{c.label}</p>
                        <TipRow label={`Mean ${METRIC_NAME[metric]}`} value={num(s.mean, 3)} />
                        <TipRow label="Std. dev. across folds" value={num(s.std, 3)} />
                        <TipRow label="Brier score" value={num(c.brier.mean, 3)} />
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setTip(null)}
              >
                <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill="transparent" />
                <text x={0} y={cy + 4} className={`text-[12px] ${c.key === selected ? "fill-ink font-semibold" : "fill-ink"}`}>
                  {c.short}
                </text>
                <line x1={x(s.mean - s.std)} x2={x(s.mean + s.std)} y1={cy} y2={cy} stroke={color} strokeWidth={2} strokeLinecap="round" />
                {s.folds.map((f, j) => (
                  <circle key={j} cx={x(f)} cy={cy - 11} r={2.5} fill={color} opacity={0.7} />
                ))}
                <circle cx={x(s.mean)} cy={cy} r={6} fill={color} stroke="var(--surface)" strokeWidth={2} />
                <text x={x(s.mean)} y={cy + 20} textAnchor="middle" className="fill-ink-soft text-[11px] tabular-nums">
                  {num(s.mean, 3)}
                </text>
              </g>
            );
          })}
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------- ROC and PR */

type CurveSet = { roc: number[][]; pr: number[][]; roc_auc?: number; pr_auc?: number };

export function CurveChart({
  model,
  reference,
  modelName,
  modelAuc,
  baseRate,
}: {
  model: CurveSet;
  reference?: CurveSet;
  modelName: string;
  modelAuc: { roc: number; pr: number };
  baseRate: number;
}) {
  const [kind, setKind] = useState<"roc" | "pr">("pr");
  const [ref, width] = useWidth<HTMLDivElement>(520);
  const [hover, setHover] = useState<number | null>(null);
  const size = Math.min(width, 440);
  const m = { l: 52, r: 14, t: 10, b: 44 };
  const x = linear([0, 1], [m.l, size - m.r]);
  const y = linear([0, 1], [size - m.b, m.t]);
  const pts = model[kind];
  const refPts = reference?.[kind];
  const path = (p: number[][]) => `M${p.map(([a, b]) => `${x(a).toFixed(1)},${y(b).toFixed(1)}`).join("L")}`;
  const hp = hover === null ? null : pts[hover];
  const isRoc = kind === "roc";

  return (
    <Figure
      title={isRoc ? "ROC curve on the test set" : "Precision-recall curve on the test set"}
      takeaway={
        isRoc
          ? "How the true-positive rate trades against false alarms as the cut-off moves. The diagonal is guessing."
          : `How precise the flagged list stays as you catch more churners. Guessing sits flat at the ${pct(baseRate)} churn rate.`
      }
      controls={
        <Segmented
          label="Curve"
          value={kind}
          onChange={setKind}
          options={[
            { value: "pr", label: "Precision-recall" },
            { value: "roc", label: "ROC" },
          ]}
        />
      }
      legend={
        <Legend
          items={[
            { color: "var(--viz-model)", label: `${modelName} (AUC ${num(isRoc ? modelAuc.roc : modelAuc.pr, 3)})`, line: true },
            ...(reference
              ? [
                  {
                    color: "var(--viz-ref)",
                    label: `Logistic regression (AUC ${num((isRoc ? reference.roc_auc : reference.pr_auc) ?? 0, 3)})`,
                    line: true,
                  },
                ]
              : []),
          ]}
        />
      }
    >
      <div ref={ref}>
        <div className="relative mx-auto" style={{ width: size }}>
          <svg
            width={size}
            height={size}
            role="img"
            aria-label={isRoc ? "ROC curve" : "Precision-recall curve"}
            onMouseMove={(e) => {
              const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
              let best = 0;
              pts.forEach((p, i) => Math.abs(x(p[0]) - px) < Math.abs(x(pts[best][0]) - px) && (best = i));
              setHover(best);
            }}
            onMouseLeave={() => setHover(null)}
          >
            <XAxis
              scale={x}
              y={size - m.b}
              values={[0, 0.25, 0.5, 0.75, 1]}
              format={(v) => num(v, 2)}
              label={isRoc ? "False-positive rate" : "Recall"}
              grid={m.t}
            />
            <YAxis
              scale={y}
              x={m.l}
              values={[0, 0.25, 0.5, 0.75, 1]}
              format={(v) => num(v, 2)}
              label={isRoc ? "True-positive rate" : "Precision"}
              gridTo={size - m.r}
            />
            {isRoc ? (
              <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink)" strokeOpacity={0.35} />
            ) : (
              <line x1={x(0)} y1={y(baseRate)} x2={x(1)} y2={y(baseRate)} stroke="var(--ink)" strokeOpacity={0.35} />
            )}
            {refPts && <path d={path(refPts)} fill="none" stroke="var(--viz-ref)" strokeWidth={2} strokeLinejoin="round" />}
            <path d={path(pts)} fill="none" stroke="var(--viz-model)" strokeWidth={2} strokeLinejoin="round" />
            {hp && <circle cx={x(hp[0])} cy={y(hp[1])} r={5} fill="var(--viz-model)" stroke="var(--surface)" strokeWidth={2} />}
          </svg>
          {hp && (
            <Tooltip
              width={size}
              tip={{
                x: x(hp[0]),
                y: y(hp[1]),
                content: isRoc ? (
                  <>
                    <TipRow label="False-positive rate" value={pct(hp[0], 1)} />
                    <TipRow label="True-positive rate" value={pct(hp[1], 1)} />
                  </>
                ) : (
                  <>
                    <TipRow label="Recall" value={pct(hp[0], 1)} />
                    <TipRow label="Precision" value={pct(hp[1], 1)} />
                  </>
                ),
              }}
            />
          )}
        </div>
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------- calibration */

type CalBin = { predicted: number; observed: number; n: number };

export function CalibrationChart({ bins, brier }: { bins: CalBin[]; brier: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(520);
  const [hover, setHover] = useState<number | null>(null);
  const size = Math.min(width, 440);
  const m = { l: 52, r: 14, t: 10, b: 44 };
  const x = linear([0, 1], [m.l, size - m.r]);
  const y = linear([0, 1], [size - m.b, m.t]);
  const hb = hover === null ? null : bins[hover];
  const worst = bins.reduce((a, b) => (Math.abs(b.observed - b.predicted) > Math.abs(a.observed - a.predicted) ? b : a));

  return (
    <Figure
      title="Can the scores be read as probabilities?"
      takeaway={
        <>
          Test customers split into ten equal-sized groups by score. Points on the diagonal mean a 30% score really does churn about 30% of
          the time. Largest gap: {pct(Math.abs(worst.observed - worst.predicted), 1)}. Brier score {num(brier, 3)}.
        </>
      }
      table={
        <DataTable
          head={["Mean predicted", "Observed churn", "Customers"]}
          rows={bins.map((b) => [pct(b.predicted, 1), pct(b.observed, 1), b.n])}
        />
      }
    >
      <div ref={ref}>
        <div className="relative mx-auto" style={{ width: size }}>
          <svg width={size} height={size} role="img" aria-label="Calibration plot: predicted probability against observed churn rate">
            <XAxis
              scale={x}
              y={size - m.b}
              values={[0, 0.25, 0.5, 0.75, 1]}
              format={(v) => pct(v)}
              label="Predicted churn probability"
              grid={m.t}
            />
            <YAxis
              scale={y}
              x={m.l}
              values={[0, 0.25, 0.5, 0.75, 1]}
              format={(v) => pct(v)}
              label="Observed churn rate"
              gridTo={size - m.r}
            />
            <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink)" strokeOpacity={0.35} />
            <path
              d={`M${bins.map((b) => `${x(b.predicted)},${y(b.observed)}`).join("L")}`}
              fill="none"
              stroke="var(--viz-model)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {bins.map((b, i) => (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <circle cx={x(b.predicted)} cy={y(b.observed)} r={12} fill="transparent" />
                <circle
                  cx={x(b.predicted)}
                  cy={y(b.observed)}
                  r={hover === i ? 6 : 4.5}
                  fill="var(--viz-model)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              </g>
            ))}
          </svg>
          {hb && hover !== null && (
            <Tooltip
              width={size}
              tip={{
                x: x(hb.predicted),
                y: y(hb.observed),
                content: (
                  <>
                    <TipRow label="Mean predicted" value={pct(hb.predicted, 1)} />
                    <TipRow label="Actually churned" value={pct(hb.observed, 1)} />
                    <TipRow label="Customers" value={hb.n} />
                  </>
                ),
              }}
            />
          )}
        </div>
      </div>
    </Figure>
  );
}

/* ---------------------------------------------------------------- gains */

type Gain = { decile: number; cumulative_capture: number; decile_churn_rate: number; lift: number };

export function GainsChart({ gains, baseRate }: { gains: Gain[]; baseRate: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 52, r: 16, t: 12, b: 44 };
  const H = 260;
  const x = linear([0, 1], [m.l, width - m.r]);
  const y = linear([0, 1], [H - m.b, m.t]);
  const pts = [[0, 0], ...gains.map((g) => [g.decile / 10, g.cumulative_capture])];
  const line = `M${pts.map(([a, b]) => `${x(a)},${y(b)}`).join("L")}`;
  const top2 = gains[1];
  const hg = hover === null ? null : gains[hover];

  return (
    <Figure
      title="Who to call first: cumulative gains"
      takeaway={
        <>
          Rank customers by score and work down the list. Calling the riskiest {pct(0.2)} reaches {pct(top2.cumulative_capture)} of everyone
          who will leave; a random {pct(0.2)} would reach {pct(0.2)}. The top tenth churns at {pct(gains[0].decile_churn_rate)},{" "}
          {num(gains[0].lift, 1)}× the {pct(baseRate)} base rate.
        </>
      }
      legend={
        <Legend
          items={[
            { color: "var(--viz-model)", label: "Ranked by model", line: true },
            { color: "var(--ink)", label: "Random order", line: true },
          ]}
        />
      }
      table={
        <DataTable
          head={["Top % of customers", "Share of churners reached", "Churn rate in this tenth", "Lift"]}
          rows={gains.map((g) => [`${g.decile * 10}%`, pct(g.cumulative_capture, 1), pct(g.decile_churn_rate, 1), `${num(g.lift, 2)}×`])}
        />
      }
    >
      <div ref={ref} className="relative">
        <svg width={width} height={H} role="img" aria-label="Cumulative gains chart">
          <XAxis
            scale={x}
            y={H - m.b}
            values={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            format={(v) => pct(v)}
            label="Share of customers contacted, riskiest first"
            grid={m.t}
          />
          <YAxis scale={y} x={m.l} values={[0, 0.25, 0.5, 0.75, 1]} format={(v) => pct(v)} label="Churners reached" gridTo={width - m.r} />
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink)" strokeOpacity={0.35} />
          <path d={`${line}L${x(1)},${y(0)}Z`} fill="var(--viz-model)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--viz-model)" strokeWidth={2} strokeLinejoin="round" />
          {gains.map((g, i) => (
            <g key={g.decile} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(g.decile / 10)} cy={y(g.cumulative_capture)} r={14} fill="transparent" />
              <circle
                cx={x(g.decile / 10)}
                cy={y(g.cumulative_capture)}
                r={hover === i ? 6 : 4}
                fill="var(--viz-model)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          ))}
          <text x={x(0.2) + 8} y={y(top2.cumulative_capture) + 18} className="fill-ink text-[12px] font-semibold tabular-nums">
            {pct(top2.cumulative_capture)}
          </text>
        </svg>
        {hg && hover !== null && (
          <Tooltip
            width={width}
            tip={{
              x: x(hg.decile / 10),
              y: y(hg.cumulative_capture),
              content: (
                <>
                  <p className="mb-1 font-semibold">Top {hg.decile * 10}% contacted</p>
                  <TipRow label="Churners reached" value={pct(hg.cumulative_capture, 1)} />
                  <TipRow label="Churn rate in this tenth" value={pct(hg.decile_churn_rate, 1)} />
                  <TipRow label="Lift" value={`${num(hg.lift, 2)}×`} />
                </>
              ),
            }}
          />
        )}
      </div>
    </Figure>
  );
}
