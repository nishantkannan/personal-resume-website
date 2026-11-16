import { report } from "@/lib/churn-report";

/**
 * The few churn-model numbers shown on the resume's project card, read from the
 * model report so they stay in step when the model is retrained. Import this from
 * server components only; the full report is too large to ship to the browser.
 */
/** The test-set cumulative gains curve, from (0, 0) to (100% called, 100% reached). */
export function churnGains(): [number, number][] {
  return [[0, 0], ...report.test.gains.map((g): [number, number] => [g.decile / 10, g.cumulative_capture])];
}

export function churnStats() {
  const top20 = report.test.gains[1].cumulative_capture;
  return [
    { value: `${Math.round(top20 * 100)}%`, label: "of churners reached by calling the riskiest 20%" },
    { value: report.test.metrics.roc_auc.toFixed(2), label: "ROC-AUC on customers it never saw" },
    { value: report.data.rows.toLocaleString("en-US"), label: "customers modelled" },
  ];
}
