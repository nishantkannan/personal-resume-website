import raw from "@/data/churn-report.json";

/**
 * The model report written by `ml/churn/train.py`. Rerun the script to refresh it;
 * the page reads every number from here, so nothing on it is typed by hand.
 */
export const report = raw;
export type Report = typeof raw;

export type SegmentRow = { group: string; churn_rate: number; n: number };
export type FairnessRow = {
  group: string;
  n: number;
  churn_rate: number;
  mean_predicted: number;
  recall: number | null;
  precision: number | null;
  roc_auc: number | null;
};
export type SweepRow = { t: number; tp: number; fp: number; fn: number; tn: number };
export type Contribution = { feature: string; label: string; value: string; shap: number };
export type Example = {
  title: string;
  probability: number;
  churned: number;
  base_value: number;
  contributions: Contribution[];
  other_shap: number;
  other_count: number;
};
