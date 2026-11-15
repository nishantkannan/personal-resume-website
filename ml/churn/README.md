# Bank customer churn model

Predicts which of a bank's 10,000 customers will close their account. The results are
shown on the site at [`/projects/churn`](../../src/app/projects/churn/page.tsx).

```bash
cd ml/churn
pip install -r requirements.txt
python -m pytest        # data and pipeline checks (a few seconds)
python train.py         # full run, about 5 minutes on 4 cores
python train.py --quick # fewer search iterations, for a smoke test
```

`train.py` writes `src/data/churn-report.json`, which the page reads, and saves the fitted
pipeline to `artifacts/churn_model.joblib` (git-ignored). Every number on the page
comes from that JSON, so rerunning the script updates the page.

## Data

| File | What it is |
| --- | --- |
| `data/customers.csv` | The customer file this project started from: 10 columns, no churn label. |
| `data/customer-churn-records-labelled.csv` | The public, labelled release of the same dataset ("Customer-Churn-Records"), used for the `Exited` label and the extra columns. |

The two files are joined on `CustomerId`. The join fails loudly if any customer is
missing or any shared column disagrees. Only `RowNumber` (file order) differs.

## Protocol

1. **Audit.** No missing values or duplicate customers; 20.4% churn. A single-column scan
   flags `Complain`: it matches the label for 99.8% of customers, so it is logged at exit
   and would leak the answer. It is dropped, along with `RowNumber`, `CustomerId` and `Surname`.
2. **One stratified 80/20 split** (seed 42). The test set is scored once, at the end.
3. **Preprocessing inside the pipeline.** Scaling and one-hot encoding are fitted on training
   folds only. The two derived features (`ZeroBalance`, `BalanceToSalary`) are row-wise, so they
   can't leak across folds.
4. **Nested cross-validation** (5 outer × 3 inner folds, randomised search) compares a
   prior-only baseline, logistic regression, random forest and LightGBM on PR-AUC.
   Ties within one standard error go to the simpler model.
5. **Threshold** chosen to maximise F1 on out-of-fold training predictions.
6. **Test evaluation:** ROC-AUC, PR-AUC, Brier score and log loss with 1,000-sample bootstrap
   confidence intervals; calibration; cumulative gains; per-group recall, ROC-AUC and calibration.
7. **Explanations:** permutation importance on the test set, and SHAP values summed back to
   the original features (one-hot columns are combined).

## Layout

```
churn/data.py         load, join and verify the two files; data audit
churn/features.py     feature lists, derived features, preprocessing pipeline
churn/evaluation.py   metrics, bootstrap intervals, curves, calibration, gains, per-group metrics
train.py              the end-to-end run that writes the report
tests/                checks on the join, leakage guards and preprocessing
```

## Limits

The data is a single snapshot with no dates, so the split is random rather than by time.
Before real use the model should be checked on a later period and monitored for drift.
There's no record of past retention offers, so it predicts who will leave, not who an
offer would keep.
