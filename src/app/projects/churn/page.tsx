import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { AgeChart, LeakageChart, SegmentGrid } from "@/components/churn/DataCharts";
import { DependencePlot, FairnessChart, ImportanceChart, Waterfall } from "@/components/churn/ExplainCharts";
import { CalibrationChart, CurveChart, GainsChart, ModelComparison } from "@/components/churn/ModelCharts";
import { ThresholdExplorer } from "@/components/churn/ThresholdExplorer";
import { report, type Example, type FairnessRow } from "@/lib/churn-report";

export const metadata: Metadata = {
  title: "Bank customer churn model | Nishant Kannan",
  description:
    "A churn model for 10,000 bank customers: leakage audit, nested cross-validation, calibrated probabilities, an interactive cut-off and SHAP explanations.",
};

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const n = (v: number) => v.toLocaleString("en-US");

const SECTIONS = [
  ["data", "The data"],
  ["leakage", "Leakage"],
  ["models", "Model choice"],
  ["performance", "Performance"],
  ["threshold", "Cut-off"],
  ["drivers", "Drivers"],
  ["fairness", "Fairness"],
  ["method", "Method"],
] as const;

export default function ChurnPage() {
  const r = report;
  const t = r.test;
  const sel = r.selected;
  const m = t.metrics;
  const ci = t.ci95;
  const explain = r.explain;
  const top2 = t.gains[1];
  const comparison = r.comparison;
  const winner = comparison.find((c) => c.key === sel.key)!;
  const logistic = comparison.find((c) => c.key === "logistic")!;
  const runnerUp = comparison.filter((c) => c.key !== sel.key && c.key !== "baseline").sort((a, b) => b.pr_auc.mean - a.pr_auc.mean)[0];
  const segments = Object.entries(r.eda.segments).map(([key, s]) => ({ key, title: s.title, rows: s.rows }));
  const products = r.eda.segments.NumOfProducts.rows;
  const germany = r.eda.segments.Geography.rows.find((g) => g.group === "Germany")!;
  const inactive = r.eda.segments.IsActiveMember.rows.find((g) => g.group === "Inactive")!;
  const active = r.eda.segments.IsActiveMember.rows.find((g) => g.group === "Active")!;
  const noise = r.permutation_importance.filter((p) => Math.abs(p.mean) < 0.002).map((p) => p.label);
  const leak = r.leakage.scan.find((s) => s.dropped)!;
  const nextBest = r.leakage.scan.find((s) => !s.dropped)!;
  const ages = r.eda.segments["Age band"].rows;
  const under40 = ages.filter((a) => a.group === "18-29" || a.group === "30-39");
  const under40Rate = under40.reduce((a, b) => a + b.churn_rate * b.n, 0) / under40.reduce((a, b) => a + b.n, 0);
  const fifties = ages.find((a) => a.group === "50-59")!;
  const calGap = t.calibration.reduce((g, b) => Math.max(g, Math.abs(b.observed - b.predicted)), 0);
  const fairRows = Object.values(r.fairness).flatMap((g) => g.rows as FairnessRow[]);
  const aucs = fairRows.map((f) => f.roc_auc ?? 0);
  const lowRecall = fairRows.filter((f) => f.recall !== null).sort((a, b) => a.recall! - b.recall!)[0];
  const fairness = Object.entries(r.fairness).map(([key, g]) => ({ key, title: g.title, rows: g.rows as FairnessRow[] }));
  const curves = t.curves as Record<string, { roc: number[][]; pr: number[][]; roc_auc?: number; pr_auc?: number }>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[76rem] items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/#project-churn" className="text-[0.9rem] font-semibold hover:text-contour">
            ← Nishant Kannan
          </Link>
          <nav aria-label="Sections" className="hidden gap-5 text-[0.85rem] text-ink-soft lg:flex">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[76rem] px-4 pb-24 sm:px-8">
        {/* ------------------------------------------------------------ hero */}
        <section aria-labelledby="title" className="pt-12 pb-10 sm:pt-16">
          <p className="text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-contour">Data science project · Churn prediction</p>
          <h1 id="title" className="display mt-3 max-w-[18ch] text-[clamp(2.2rem,1.4rem+3.4vw,3.8rem)] font-extrabold">
            Which bank customers are about to leave?
          </h1>
          <p className="mt-5 max-w-[62ch] text-lg text-ink-soft">
            A model that ranks {n(r.data.rows)} bank customers by their risk of closing their account, built to be trusted: the data was
            checked for leaks, models were compared without peeking at the test set, and every score can be explained.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            <Tile
              label="Churners caught by calling the riskiest 20%"
              value={pct(top2.cumulative_capture)}
              note={`${(top2.cumulative_capture / 0.2).toFixed(1)}× better than calling at random`}
            />
            <Tile
              label="ROC-AUC on unseen customers"
              value={m.roc_auc.toFixed(3)}
              note={`95% CI ${ci.roc_auc[0].toFixed(2)}–${ci.roc_auc[1].toFixed(2)}`}
            />
            <Tile
              label="PR-AUC on unseen customers"
              value={m.pr_auc.toFixed(3)}
              note={`vs ${t.base_rate.toFixed(2)} for guessing · CI ${ci.pr_auc[0].toFixed(2)}–${ci.pr_auc[1].toFixed(2)}`}
            />
            <Tile label="Model" value={sel.short} note={`picked from ${comparison.length - 1} candidates + a baseline`} small />
          </dl>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Finding n="1" title="Age and product count drive churn">
              Customers in their 50s churn at {pct(fifties.churn_rate)}, against {pct(under40Rate)} for those under 40. Holding three or
              four products is a strong warning sign: {pct(products[2].churn_rate)} and {pct(products[3].churn_rate)} churn, against{" "}
              {pct(products[1].churn_rate)} with two.
            </Finding>
            <Finding n="2" title="Inactive members and Germany are higher-risk">
              Inactive members churn at {pct(inactive.churn_rate)} vs {pct(active.churn_rate)} for active ones, and German customers at{" "}
              {pct(germany.churn_rate)}, about double France and Spain.
            </Finding>
            <Finding n="3" title="One column had to go">
              &ldquo;Complain&rdquo; matches the churn label for {pct(r.leakage.complain_matches_label, 1)} of customers. It is almost
              certainly recorded at exit, so a model using it would look perfect in testing and fail in production.
            </Finding>
          </div>
        </section>

        {/* ------------------------------------------------------------ data */}
        <Section id="data" kicker="01" title="The data">
          <Prose>
            <p>
              {n(r.data.rows)} customers of a European retail bank, with {pct(r.data.churn_rate, 1)} ({n(r.data.churners)}) having closed
              their account. The customer file had no churn label, so the label was joined on from the public release of the same dataset by
              customer ID. All {r.data.columns_checked.length} shared columns were checked and agree for every customer.
            </p>
            <p>
              No missing values, no duplicate customers. The classes are imbalanced (about one churner for every four who stay), so accuracy
              is a poor yardstick: predicting &ldquo;stays&rdquo; for everyone is already {pct(1 - r.data.churn_rate)} accurate. The metrics
              below focus on how well churners are found.
            </p>
          </Prose>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Customers" value={n(r.data.rows)} />
            <Fact label="Churn rate" value={pct(r.data.churn_rate, 1)} />
            <Fact label="Missing values" value={n(r.data.missing_cells)} />
            <Fact label="Features used" value={`${r.data.features.length} + ${r.data.engineered.length} derived`} />
          </dl>
          <div className="mt-6 grid gap-4">
            <SegmentGrid segments={segments} overall={r.data.churn_rate} />
            <AgeChart bins={r.eda.age_histogram} overall={r.data.churn_rate} />
          </div>
        </Section>

        {/* --------------------------------------------------------- leakage */}
        <Section id="leakage" kicker="02" title="A column that gives the answer away">
          <Prose>
            <p>
              Before modelling, every column was scored on its own against the label. &ldquo;{leak.label}&rdquo; scores{" "}
              {leak.single_feature_auc.toFixed(3)} ROC-AUC alone; the next best, {nextBest.label.toLowerCase()}, manages{" "}
              {nextBest.single_feature_auc.toFixed(2)}. {pct(r.leakage.complained_share_of_churners, 1)} of churners have a complaint on
              file, against {pct(r.leakage.complained_share_of_stayers, 1)} of customers who stayed.
            </p>
            <p>
              That pattern means the complaint is logged as part of leaving, not before it. A model trained with it scores{" "}
              {r.leakage.complain_only_test_auc.toFixed(3)} on the test set and would be worthless for spotting churn in time to act. It was
              dropped, along with the row number, customer ID and surname, which identify customers but say nothing about them.
            </p>
          </Prose>
          <div className="mt-6">
            <LeakageChart rows={r.leakage.scan} />
          </div>
        </Section>

        {/* ---------------------------------------------------------- models */}
        <Section id="models" kicker="03" title="Choosing a model">
          <Prose>
            <p>
              {pct(r.data.train_rows / r.data.rows)} of customers ({n(r.data.train_rows)}) were used for all model building; the other{" "}
              {n(r.data.test_rows)} were set aside, with the same churn rate, and used once at the very end. Four candidates were compared
              with nested cross-validation: each is tuned with a random search inside every fold, then scored on that fold&rsquo;s held-out
              part.
            </p>
            <p>
              The selection metric is PR-AUC, which rewards finding churners without flooding the list with false alarms. {winner.short}{" "}
              scored {winner.pr_auc.mean.toFixed(3)} ± {winner.pr_auc.std.toFixed(3)} and {runnerUp.short} {runnerUp.pr_auc.mean.toFixed(3)}{" "}
              ± {runnerUp.pr_auc.std.toFixed(3)}
              {winner.pr_auc.mean < runnerUp.pr_auc.mean
                ? `, a difference well inside fold-to-fold noise; the rule is to prefer the simpler model when scores are within one standard error, so ${winner.short.toLowerCase()} was chosen.`
                : "."}{" "}
              Logistic regression trails at {logistic.pr_auc.mean.toFixed(3)}: churn risk rises and falls with age and jumps at three
              products, which a straight-line model can&rsquo;t follow.
            </p>
          </Prose>
          <div className="mt-6">
            <ModelComparison candidates={comparison} selected={sel.key} />
          </div>
        </Section>

        {/* ----------------------------------------------------- performance */}
        <Section id="performance" kicker="04" title="How well it works on customers it has never seen">
          <Prose>
            <p>
              On the {n(r.data.test_rows)} held-out customers the model reaches {m.roc_auc.toFixed(3)} ROC-AUC and {m.pr_auc.toFixed(3)}{" "}
              PR-AUC. The ranges are 95% bootstrap intervals from resampling the test set {n(t.n_boot)} times. The scores also work as
              probabilities: across ten equal groups of customers, predicted and actual churn never differ by more than{" "}
              {(calGap * 100).toFixed(1)} percentage points. That matters when the numbers feed a budget.
            </p>
          </Prose>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <CurveChart
              model={curves[sel.key]}
              reference={curves.logistic}
              modelName={sel.short}
              modelAuc={{ roc: m.roc_auc, pr: m.pr_auc }}
              baseRate={t.base_rate}
            />
            <CalibrationChart bins={t.calibration} brier={m.brier} />
          </div>
          <div className="mt-4">
            <GainsChart gains={t.gains} baseRate={t.base_rate} />
          </div>
        </Section>

        {/* ------------------------------------------------------- threshold */}
        <Section id="threshold" kicker="05" title="Pick a cut-off">
          <Prose>
            <p>
              The model outputs a probability; the business decides who gets a call. The default cut-off of {pct(r.threshold.value)} was
              chosen on out-of-fold predictions from the training set, where it maximises F1, so the test set played no part. A cheap offer
              justifies a lower cut-off and a longer list. Drag the slider, or plug in your own costs.
            </p>
          </Prose>
          <div className="mt-6">
            <ThresholdExplorer sweep={t.sweep} histogram={t.score_histogram} chosen={r.threshold.value} testRows={r.data.test_rows} />
          </div>
        </Section>

        {/* --------------------------------------------------------- drivers */}
        {explain && (
          <Section id="drivers" kicker="06" title="What drives the risk">
            <Prose>
              <p>
                Both methods put age and products held far ahead of everything else, with activity, country, gender and balance next.{" "}
                {noise.length > 0 && (
                  <>
                    {joinList(noise)} add essentially nothing; shuffling them barely moves the score. The model tolerates them, but they
                    would be the first to cut in a leaner version.
                  </>
                )}
              </p>
            </Prose>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <ImportanceChart shap={explain.importance} permutation={r.permutation_importance} units={explain.units} />
              <DependencePlot dependence={explain.dependence} units={explain.units} />
            </div>
            <div className="mt-4">
              <Waterfall examples={explain.examples as Example[]} units={explain.units} />
            </div>
          </Section>
        )}

        {/* -------------------------------------------------------- fairness */}
        <Section id="fairness" kicker="07" title="Checking it across groups">
          <Prose>
            <p>
              A model can score well overall and still fail a group. Ranking quality holds up everywhere (ROC-AUC between{" "}
              {Math.min(...aucs).toFixed(2)} and {Math.max(...aucs).toFixed(2)}), and each group&rsquo;s average score sits close to its
              real churn rate. Recall is where groups differ: at the default cut-off the model flags only {pct(lowRecall.recall!)} of
              churners aged {lowRecall.group}, because young customers rarely churn and few of them score high. If young churners matter to
              the business, they need a lower cut-off of their own.
            </p>
          </Prose>
          <div className="mt-6">
            <FairnessChart groups={fairness} />
          </div>
        </Section>

        {/* ---------------------------------------------------------- method */}
        <Section id="method" kicker="08" title="Method and reproducibility">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <ol className="flex flex-col gap-3 text-[0.95rem]">
              {[
                [
                  "Join and verify",
                  "Label joined by customer ID; every shared column checked for agreement; the pipeline stops on any mismatch.",
                ],
                [
                  "Audit",
                  "Missing values, duplicates, class balance, and a single-column leakage scan. Identifiers and the leaky column are dropped.",
                ],
                [
                  "Split once",
                  `Stratified ${pct(r.data.train_rows / r.data.rows)}/${pct(r.data.test_rows / r.data.rows)} split with a fixed seed (${r.seed}). The test set is scored once.`,
                ],
                [
                  "Preprocess inside the pipeline",
                  "Scaling and one-hot encoding are fitted on training folds only, so cross-validation scores aren't inflated.",
                ],
                ["Nested cross-validation", "5 outer folds × 3 inner folds with randomised hyperparameter search, scored on PR-AUC."],
                ["Threshold from training data", r.threshold.rule],
                [
                  "Evaluate",
                  "ROC-AUC, PR-AUC, Brier score and log loss with bootstrap confidence intervals, plus calibration, lift and per-group checks.",
                ],
                ["Explain", "Permutation importance on the test set and SHAP values, summed back to the original features."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-[0.75rem] font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-semibold">{title}.</span> <span className="text-ink-soft">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="rounded-2xl border border-line bg-surface p-5 text-[0.85rem]">
              <p className="font-semibold">Final model</p>
              <p className="mt-1 text-ink-soft">{sel.label}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
                {Object.entries(sel.params).map(([k, v]) => (
                  <Fragment key={k}>
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="text-right">{String(v)}</dd>
                  </Fragment>
                ))}
              </dl>
              <p className="mt-5 font-semibold">Reproduce</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-3 text-[0.78rem] leading-relaxed">
                {`cd ml/churn
pip install -r requirements.txt
python -m pytest
python train.py`}
              </pre>
              <p className="mt-3 text-ink-soft">
                Python {r.environment.python} · scikit-learn {r.environment.scikit_learn} · LightGBM {r.environment.lightgbm} · SHAP{" "}
                {r.environment.shap}. Report generated {r.generated_at}.
              </p>
            </div>
          </div>
          <p className="mt-8 max-w-[70ch] text-[0.85rem] text-ink-soft">
            Limits: this is one bank&rsquo;s snapshot, with no dates, so the split is random rather than by time. In production the model
            should be validated on a later period before use, and monitored for drift. The data has no record of past retention offers, so
            the model predicts who will leave, not who an offer would keep.
          </p>
        </Section>
      </main>
    </div>
  );
}

function joinList(raw: string[]) {
  // Mid-sentence, so lower-case all but the first and drop unit notes like "(years)".
  const items = raw.map((s, i) => {
    const clean = s.replace(/\s*\(.*\)$/, "");
    return i === 0 ? clean : clean.charAt(0).toLowerCase() + clean.slice(1);
  });
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-line pt-12 pb-6">
      <p className="text-[0.8rem] font-semibold tabular-nums text-contour">{kicker}</p>
      <h2 id={`${id}-title`} className="section-title mt-1">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="flex max-w-[68ch] flex-col gap-4 text-[1.02rem]">{children}</div>;
}

function Tile({ label, value, note, small }: { label: string; value: string; note: string; small?: boolean }) {
  return (
    <div className="bg-surface p-5">
      <dt className="text-[0.85rem] leading-snug text-ink-soft">{label}</dt>
      <dd
        className={`mt-2 font-semibold leading-none ${small ? "text-[1.75rem]" : "text-[2.6rem]"}`}
        style={{ fontVariantNumeric: "proportional-nums" }}
      >
        {value}
      </dd>
      <dd className="mt-2 text-[0.8rem] text-ink-soft">{note}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <dt className="text-[0.8rem] text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function Finding({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <p className="flex items-center gap-2 font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-[0.75rem] text-bg">{n}</span>
        {title}
      </p>
      <p className="mt-2 text-[0.92rem] text-ink-soft">{children}</p>
    </div>
  );
}
