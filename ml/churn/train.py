"""Train, evaluate and explain the churn model, then write the report the site reads.

    python train.py            # full run (~1-2 min)
    python train.py --quick    # fewer search iterations and bootstraps, for a smoke test

Protocol
  1. Join the label onto the customer file and check every shared column agrees.
  2. Audit: missing values, duplicates, class balance, and a single-feature scan for
     label leakage. Leaky and identifier columns are dropped.
  3. One stratified 80/20 split. The 20% test set is touched exactly once, at the end.
  4. Compare candidate models with nested cross-validation on the training set:
     hyperparameters are tuned in an inner loop, scored in an outer loop, so the
     comparison is not biased by tuning on the same folds it is scored on.
  5. Refit the winner on all training data (tuning again with the same search).
  6. Pick the decision threshold from out-of-fold training predictions, not the test set.
  7. Score the test set once: metrics with bootstrap confidence intervals, curves,
     calibration, lift, per-group performance, permutation importance and SHAP.
"""

from __future__ import annotations

import argparse
import json
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm
import numpy as np
import pandas as pd
import shap
import sklearn
from lightgbm import LGBMClassifier
from scipy.stats import loguniform, randint, uniform
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import (
    RandomizedSearchCV,
    StratifiedKFold,
    cross_val_predict,
    cross_validate,
    train_test_split,
)
from sklearn.pipeline import Pipeline

from churn import data as data_mod
from churn import evaluation as ev
from churn.features import (
    BINARY,
    CATEGORICAL,
    FEATURE_LABELS,
    NUMERIC,
    RAW_FEATURES,
    make_preprocessor,
    source_feature,
)

SEED = 42
HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
REPORT_PATH = REPO / "src" / "data" / "churn-report.json"
ARTIFACT_DIR = HERE / "artifacts"

SCORING = {
    "roc_auc": "roc_auc",
    "pr_auc": "average_precision",
    "brier": "neg_brier_score",
    "log_loss": "neg_log_loss",
}


def candidates(n_iter: int) -> dict[str, dict]:
    """Each candidate is a pipeline plus an (optional) search space."""
    inner = StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED)

    def search(pipe, space, iters):
        return RandomizedSearchCV(
            pipe,
            space,
            n_iter=iters,
            scoring="average_precision",
            cv=inner,
            random_state=SEED,
            n_jobs=-1,
            refit=True,
        )

    lr = Pipeline([("prep", make_preprocessor(scale=True)), ("model", LogisticRegression(max_iter=2000))])
    rf = Pipeline(
        [("prep", make_preprocessor(scale=False)), ("model", RandomForestClassifier(random_state=SEED, n_jobs=1))]
    )
    gbm = Pipeline(
        [
            ("prep", make_preprocessor(scale=False)),
            ("model", LGBMClassifier(random_state=SEED, verbose=-1, n_jobs=1)),
        ]
    )
    return {
        "baseline": {
            "label": "Baseline (always predicts the churn rate)",
            "short": "Baseline",
            "estimator": Pipeline([("prep", make_preprocessor(scale=False)), ("model", DummyClassifier(strategy="prior"))]),
        },
        "logistic": {
            "label": "Logistic regression",
            "short": "Logistic",
            "estimator": search(lr, {"model__C": loguniform(1e-3, 1e2)}, max(8, n_iter // 3)),
        },
        "random_forest": {
            "label": "Random forest",
            "short": "Random forest",
            "estimator": search(
                rf,
                {
                    "model__n_estimators": randint(200, 600),
                    "model__max_depth": randint(4, 16),
                    "model__min_samples_leaf": randint(1, 30),
                    "model__max_features": uniform(0.2, 0.6),
                },
                max(6, n_iter // 2),
            ),
        },
        "lightgbm": {
            "label": "Gradient-boosted trees (LightGBM)",
            "short": "LightGBM",
            "estimator": search(
                gbm,
                {
                    "model__n_estimators": randint(100, 700),
                    "model__learning_rate": loguniform(0.01, 0.2),
                    "model__num_leaves": randint(4, 48),
                    "model__min_child_samples": randint(10, 120),
                    "model__subsample": uniform(0.6, 0.4),
                    "model__subsample_freq": [1],
                    "model__colsample_bytree": uniform(0.5, 0.5),
                    "model__reg_lambda": loguniform(1e-3, 10),
                },
                n_iter,
            ),
        },
    }


def leakage_scan(df: pd.DataFrame) -> list[dict]:
    """ROC-AUC of each column on its own. Anything near 1.0 is suspect."""
    y = df[data_mod.TARGET].to_numpy()
    rows = []
    for col in RAW_FEATURES + data_mod.LEAKY_COLUMNS:
        x = df[col]
        if x.dtype == object or str(x.dtype) in ("str", "string", "category"):
            x = x.map(df.groupby(col)[data_mod.TARGET].mean())
        auc = roc_auc_score(y, x)
        auc = max(auc, 1 - auc)  # direction does not matter for a leakage check
        rows.append(
            {
                "feature": col,
                "label": FEATURE_LABELS.get(col, col),
                "single_feature_auc": ev.r(auc),
                "dropped": col in data_mod.LEAKY_COLUMNS,
            }
        )
    return sorted(rows, key=lambda d: -d["single_feature_auc"])


def segment_rates(df: pd.DataFrame) -> dict:
    d = df.copy()
    d["Age band"] = pd.cut(d["Age"], [17, 29, 39, 49, 59, 100], labels=["18-29", "30-39", "40-49", "50-59", "60+"])
    d["Balance band"] = np.where(d["Balance"] == 0, "Zero", "Non-zero")
    spec = {
        "Geography": ("Country", None),
        "Gender": ("Gender", None),
        "Age band": ("Age", None),
        "NumOfProducts": ("Products held", None),
        "IsActiveMember": ("Activity", {0: "Inactive", 1: "Active"}),
        "Balance band": ("Balance", None),
    }
    out = {}
    for col, (title, names) in spec.items():
        g = d.groupby(col, observed=True)[data_mod.TARGET].agg(["mean", "size"]).reset_index()
        out[col] = {
            "title": title,
            "rows": [
                {"group": str(names[k] if names else k), "churn_rate": ev.r(m), "n": int(n)}
                for k, m, n in g.itertuples(index=False)
            ],
        }
    return out


def age_histogram(df: pd.DataFrame) -> list[dict]:
    bins = np.arange(18, 96, 3)
    out = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        m = (df["Age"] >= lo) & (df["Age"] < hi)
        out.append(
            {
                "lo": int(lo),
                "hi": int(hi),
                "stayed": int((m & (df[data_mod.TARGET] == 0)).sum()),
                "churned": int((m & (df[data_mod.TARGET] == 1)).sum()),
            }
        )
    return out


def unwrap(fitted) -> Pipeline:
    return fitted.best_estimator_ if hasattr(fitted, "best_estimator_") else fitted


def shap_section(pipe: Pipeline, X_test: pd.DataFrame, y_test: np.ndarray, p_test: np.ndarray, seed: int) -> dict:
    prep, model = pipe.named_steps["prep"], pipe.named_steps["model"]
    Xt = pd.DataFrame(prep.transform(X_test), columns=prep.get_feature_names_out(), index=X_test.index)
    explainer = shap.TreeExplainer(model)
    sv = explainer.shap_values(Xt)
    if isinstance(sv, list):
        sv = sv[1]
    sv = np.asarray(sv)
    if sv.ndim == 3:
        sv = sv[:, :, 1]
    base = float(np.ravel(explainer.expected_value)[-1])
    # sklearn forests explain probabilities; LightGBM explains log-odds.
    units = "probability" if isinstance(model, RandomForestClassifier) else "log-odds"

    # Sum one-hot columns back into their source feature, so "Country" is one bar.
    groups: dict[str, list[int]] = {}
    for i, name in enumerate(Xt.columns):
        groups.setdefault(source_feature(name), []).append(i)
    feat_names = list(groups)
    S = np.column_stack([sv[:, idx].sum(axis=1) for idx in groups.values()])

    mean_abs = np.abs(S).mean(axis=0)
    order = np.argsort(-mean_abs)
    importance = [
        {"feature": feat_names[i], "label": FEATURE_LABELS.get(feat_names[i], feat_names[i]), "mean_abs_shap": ev.r(mean_abs[i])}
        for i in order
    ]

    raw = X_test.copy()
    raw["ZeroBalance"] = (raw["Balance"] == 0).astype(int)
    raw["BalanceToSalary"] = raw["Balance"] / raw["EstimatedSalary"].clip(lower=1.0)

    rng = np.random.default_rng(seed)
    sample = rng.choice(len(X_test), size=min(700, len(X_test)), replace=False)
    dependence = {}
    for f in ["Age", "NumOfProducts", "Balance", "IsActiveMember", "Geography", "CreditScore"]:
        j = feat_names.index(f)
        dependence[f] = {
            "label": FEATURE_LABELS[f],
            "categorical": f in CATEGORICAL or f in BINARY or f == "NumOfProducts",
            "points": [[raw[f].iloc[i] if f in CATEGORICAL else ev.r(raw[f].iloc[i], 2), ev.r(S[i, j], 3)] for i in sample],
        }

    # A handful of test customers across the risk range, each with its top drivers.
    ranked = np.argsort(-p_test)
    picks = {
        "Highest risk": ranked[0],
        "High risk": ranked[int(len(ranked) * 0.05)],
        "Borderline": ranked[int(len(ranked) * 0.2)],
        "Typical": ranked[int(len(ranked) * 0.5)],
        "Low risk": ranked[int(len(ranked) * 0.9)],
        "Lowest risk": ranked[-1],
    }
    examples = []
    for title, i in picks.items():
        contrib = sorted(
            ({"feature": f, "label": FEATURE_LABELS.get(f, f), "value": _display_value(f, raw.iloc[i]), "shap": ev.r(S[i, k], 3)}
             for k, f in enumerate(feat_names)),
            key=lambda d: -abs(d["shap"]),
        )
        top, rest = contrib[:6], contrib[6:]
        examples.append(
            {
                "title": title,
                "probability": ev.r(p_test[i]),
                "churned": int(y_test[i]),
                "base_value": ev.r(base, 3),
                "contributions": top,
                "other_shap": ev.r(sum(d["shap"] for d in rest), 3),
                "other_count": len(rest),
            }
        )
    return {"base_value": ev.r(base, 3), "units": units, "importance": importance, "dependence": dependence, "examples": examples}


def _display_value(feature: str, row: pd.Series) -> str:
    v = row[feature]
    if feature in ("Balance", "EstimatedSalary"):
        return f"${v:,.0f}"
    if feature in ("HasCrCard", "IsActiveMember", "ZeroBalance"):
        return "Yes" if v else "No"
    if feature == "BalanceToSalary":
        return f"{v:.2f}"
    return str(v)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()
    n_iter = 8 if args.quick else 30
    n_boot = 200 if args.quick else 1000
    started = time.time()

    # 1-2. Load, join, audit.
    loaded = data_mod.load()
    df = loaded.frame
    audit = data_mod.audit(df)
    leakage = leakage_scan(df)
    print(f"Loaded {len(df):,} customers, churn rate {audit['churn_rate']:.1%}")

    X = df[RAW_FEATURES]
    y = df[data_mod.TARGET].to_numpy()

    # 3. Hold out a test set, stratified so it has the same churn rate.
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)

    # 4. Nested CV model comparison.
    outer = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    cands = candidates(n_iter)
    comparison = []
    for key, c in cands.items():
        t0 = time.time()
        cv = cross_validate(c["estimator"], X_train, y_train, cv=outer, scoring=SCORING, n_jobs=1)
        row = {"key": key, "label": c["label"], "short": c["short"], "seconds": round(time.time() - t0, 1)}
        for m in SCORING:
            vals = cv[f"test_{m}"] * (-1 if m in ("brier", "log_loss") else 1)
            row[m] = {"mean": ev.r(vals.mean()), "std": ev.r(vals.std()), "folds": [ev.r(v) for v in vals]}
        comparison.append(row)
        print(f"  {c['short']:<14} PR-AUC {row['pr_auc']['mean']:.3f} ± {row['pr_auc']['std']:.3f}   ROC-AUC {row['roc_auc']['mean']:.3f}")

    # Select on mean PR-AUC: it focuses on the minority class, which is what the
    # retention team acts on. Ties within one standard error go to the simpler model.
    ranked = sorted([c for c in comparison if c["key"] != "baseline"], key=lambda c: -c["pr_auc"]["mean"])
    best = ranked[0]
    simpler_order = ["logistic", "random_forest", "lightgbm"]
    for c in sorted(ranked, key=lambda c: simpler_order.index(c["key"])):
        if c["pr_auc"]["mean"] >= best["pr_auc"]["mean"] - best["pr_auc"]["std"] / np.sqrt(5):
            winner_key = c["key"]
            break
    print(f"Selected: {winner_key}")

    # 5. Refit the winner (with its search) on the full training set.
    final_search = clone(cands[winner_key]["estimator"])
    final_search.fit(X_train, y_train)
    pipe = unwrap(final_search)
    best_params = {k.replace("model__", ""): (ev.r(v, 5) if isinstance(v, float) else v) for k, v in getattr(final_search, "best_params_", {}).items()}

    # 6. Threshold and calibration check from out-of-fold predictions on training data.
    oof = cross_val_predict(clone(pipe), X_train, y_train, cv=outer, method="predict_proba")[:, 1]
    threshold = ev.best_f1_threshold(y_train, oof)
    oof_calibration = ev.calibration_bins(y_train, oof)

    # 7. Test set, once.
    p_test = pipe.predict_proba(X_test)[:, 1]
    test_metrics = ev.headline_metrics(y_test, p_test, threshold)
    ci = ev.bootstrap_ci(y_test, p_test, threshold, n_boot, SEED)

    # Curves for the winner and the logistic baseline, so the page can compare them.
    curves = {winner_key: {"roc": ev.roc_points(y_test, p_test), "pr": ev.pr_points(y_test, p_test)}}
    if winner_key != "logistic":
        lr = unwrap(clone(cands["logistic"]["estimator"]).fit(X_train, y_train))
        p_lr = lr.predict_proba(X_test)[:, 1]
        curves["logistic"] = {
            "roc": ev.roc_points(y_test, p_lr),
            "pr": ev.pr_points(y_test, p_lr),
            "roc_auc": ev.r(roc_auc_score(y_test, p_lr)),
            "pr_auc": ev.r(average_precision_score(y_test, p_lr)),
        }

    # What the leaky column would have done, to show why it was dropped.
    leak_X = df[RAW_FEATURES + data_mod.LEAKY_COLUMNS]
    lX_tr, lX_te, ly_tr, ly_te = train_test_split(leak_X, y, test_size=0.2, stratify=y, random_state=SEED)
    leak_model = LogisticRegression(max_iter=2000).fit(lX_tr[data_mod.LEAKY_COLUMNS], ly_tr)
    leak_auc = roc_auc_score(ly_te, leak_model.predict_proba(lX_te[data_mod.LEAKY_COLUMNS])[:, 1])

    # Permutation importance on the test set, in units of ROC-AUC lost.
    perm = permutation_importance(pipe, X_test, y_test, scoring="roc_auc", n_repeats=15, random_state=SEED, n_jobs=-1)
    perm_rows = sorted(
        (
            {"feature": f, "label": FEATURE_LABELS.get(f, f), "mean": ev.r(perm.importances_mean[i]), "std": ev.r(perm.importances_std[i])}
            for i, f in enumerate(RAW_FEATURES)
        ),
        key=lambda d: -d["mean"],
    )

    test_frame = X_test.reset_index(drop=True).copy()
    test_frame["Age band"] = pd.cut(test_frame["Age"], [17, 39, 54, 100], labels=["18-39", "40-54", "55+"])
    fairness = {
        "Geography": {"title": "Country", "rows": ev.subgroup_metrics(test_frame, y_test, p_test, threshold, "Geography")},
        "Gender": {"title": "Gender", "rows": ev.subgroup_metrics(test_frame, y_test, p_test, threshold, "Gender")},
        "Age band": {"title": "Age", "rows": ev.subgroup_metrics(test_frame, y_test, p_test, threshold, "Age band")},
    }

    explain = shap_section(pipe, X_test.reset_index(drop=True), y_test, p_test, SEED) if winner_key in ("lightgbm", "random_forest") else None

    report = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "seed": SEED,
        "runtime_seconds": round(time.time() - started, 1),
        "environment": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "lightgbm": lightgbm.__version__,
            "shap": shap.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
        "data": {
            **audit,
            "customers_sha256": loaded.customers_sha256,
            "labelled_sha256": loaded.labelled_sha256,
            "columns_checked": loaded.columns_checked,
            "train_rows": int(len(y_train)),
            "test_rows": int(len(y_test)),
            "train_churn_rate": ev.r(y_train.mean()),
            "test_churn_rate": ev.r(y_test.mean()),
            "dropped_identifiers": data_mod.ID_COLUMNS,
            "dropped_leaky": data_mod.LEAKY_COLUMNS,
            "features": [{"feature": f, "label": FEATURE_LABELS[f]} for f in RAW_FEATURES],
            "engineered": [{"feature": f, "label": FEATURE_LABELS[f]} for f in ("ZeroBalance", "BalanceToSalary")],
            "numeric": NUMERIC,
            "categorical": CATEGORICAL + BINARY,
        },
        "leakage": {
            "scan": leakage,
            "complain_only_test_auc": ev.r(leak_auc),
            "complained_share_of_churners": ev.r(df.loc[df[data_mod.TARGET] == 1, "Complain"].mean()),
            "complained_share_of_stayers": ev.r(df.loc[df[data_mod.TARGET] == 0, "Complain"].mean()),
            "complain_matches_label": ev.r((df["Complain"] == df[data_mod.TARGET]).mean()),
        },
        "eda": {"segments": segment_rates(df), "age_histogram": age_histogram(df)},
        "comparison": comparison,
        "selected": {
            "key": winner_key,
            "label": cands[winner_key]["label"],
            "short": cands[winner_key]["short"],
            "params": best_params,
            "rule": "Highest mean PR-AUC in nested CV; ties within one standard error go to the simpler model.",
        },
        "threshold": {"value": threshold, "rule": "Maximises F1 on out-of-fold training predictions."},
        "test": {
            "metrics": test_metrics,
            "ci95": ci,
            "n_boot": n_boot,
            "base_rate": ev.r(y_test.mean()),
            "curves": curves,
            "calibration": ev.calibration_bins(y_test, p_test),
            "oof_calibration": oof_calibration,
            "sweep": ev.threshold_sweep(y_test, p_test),
            "gains": ev.gains_by_decile(y_test, p_test),
            "score_histogram": _score_hist(y_test, p_test),
        },
        "fairness": fairness,
        "permutation_importance": perm_rows,
        "explain": explain,
    }

    REPORT_PATH.write_text(json.dumps(report, separators=(",", ":"), default=_json_default) + "\n")
    ARTIFACT_DIR.mkdir(exist_ok=True)
    joblib.dump({"pipeline": pipe, "threshold": threshold, "features": RAW_FEATURES}, ARTIFACT_DIR / "churn_model.joblib")
    print(f"Test ROC-AUC {test_metrics['roc_auc']:.3f}  PR-AUC {test_metrics['pr_auc']:.3f}  threshold {threshold}")
    print(f"Wrote {REPORT_PATH.relative_to(REPO)} in {time.time() - started:.0f}s")


def _score_hist(y: np.ndarray, p: np.ndarray) -> list[dict]:
    edges = np.linspace(0, 1, 21)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & ((p < hi) if hi < 1 else (p <= hi))
        out.append({"lo": ev.r(lo, 2), "hi": ev.r(hi, 2), "stayed": int((m & (y == 0)).sum()), "churned": int((m & (y == 1)).sum())})
    return out


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    raise TypeError(type(o))


if __name__ == "__main__":
    main()
