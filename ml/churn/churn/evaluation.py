"""Metrics, curves and summaries computed from predicted probabilities."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    log_loss,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


def r(x: float, n: int = 4) -> float:
    return float(round(float(x), n))


def headline_metrics(y: np.ndarray, p: np.ndarray, threshold: float) -> dict:
    pred = (p >= threshold).astype(int)
    return {
        "roc_auc": r(roc_auc_score(y, p)),
        "pr_auc": r(average_precision_score(y, p)),
        "brier": r(brier_score_loss(y, p)),
        "log_loss": r(log_loss(y, p)),
        "precision": r(precision_score(y, pred, zero_division=0)),
        "recall": r(recall_score(y, pred)),
        "f1": r(f1_score(y, pred)),
    }


def bootstrap_ci(y: np.ndarray, p: np.ndarray, threshold: float, n_boot: int, seed: int) -> dict:
    """95% percentile intervals from resampling the test set with replacement."""
    rng = np.random.default_rng(seed)
    n = len(y)
    samples: dict[str, list[float]] = {}
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        if y[idx].min() == y[idx].max():
            continue
        for k, v in headline_metrics(y[idx], p[idx], threshold).items():
            samples.setdefault(k, []).append(v)
    return {k: [r(np.percentile(v, 2.5)), r(np.percentile(v, 97.5))] for k, v in samples.items()}


def _thin(xs: np.ndarray, ys: np.ndarray, max_points: int = 200) -> list[list[float]]:
    if len(xs) > max_points:
        keep = np.unique(np.linspace(0, len(xs) - 1, max_points).astype(int))
        xs, ys = xs[keep], ys[keep]
    return [[r(a), r(b)] for a, b in zip(xs, ys)]


def roc_points(y: np.ndarray, p: np.ndarray) -> list[list[float]]:
    fpr, tpr, _ = roc_curve(y, p)
    return _thin(fpr, tpr)


def pr_points(y: np.ndarray, p: np.ndarray) -> list[list[float]]:
    precision, recall, _ = precision_recall_curve(y, p)
    # Reverse so recall runs 0 -> 1.
    return _thin(recall[::-1], precision[::-1])


def calibration_bins(y: np.ndarray, p: np.ndarray, n_bins: int = 10) -> list[dict]:
    """Quantile bins, so each point rests on the same number of customers."""
    edges = np.unique(np.quantile(p, np.linspace(0, 1, n_bins + 1)))
    which = np.clip(np.searchsorted(edges, p, side="right") - 1, 0, len(edges) - 2)
    out = []
    for b in range(len(edges) - 1):
        m = which == b
        if m.sum() == 0:
            continue
        out.append({"predicted": r(p[m].mean()), "observed": r(y[m].mean()), "n": int(m.sum())})
    return out


def threshold_sweep(y: np.ndarray, p: np.ndarray) -> list[dict]:
    rows = []
    for t in np.round(np.arange(0.02, 0.99, 0.01), 2):
        pred = p >= t
        tp = int((pred & (y == 1)).sum())
        fp = int((pred & (y == 0)).sum())
        fn = int((~pred & (y == 1)).sum())
        tn = int((~pred & (y == 0)).sum())
        rows.append({"t": float(t), "tp": tp, "fp": fp, "fn": fn, "tn": tn})
    return rows


def best_f1_threshold(y: np.ndarray, p: np.ndarray) -> float:
    ts = np.round(np.arange(0.05, 0.95, 0.01), 2)
    scores = [f1_score(y, p >= t) for t in ts]
    return float(ts[int(np.argmax(scores))])


def gains_by_decile(y: np.ndarray, p: np.ndarray) -> list[dict]:
    """Share of all churners caught when contacting the top k% riskiest customers."""
    order = np.argsort(-p, kind="stable")
    y_sorted = y[order]
    total = y.sum()
    base = y.mean()
    out = []
    for k in range(1, 11):
        n = int(round(len(y) * k / 10))
        caught = y_sorted[:n].sum()
        decile = y_sorted[int(round(len(y) * (k - 1) / 10)) : n]
        out.append(
            {
                "decile": k,
                "cumulative_capture": r(caught / total),
                "decile_churn_rate": r(decile.mean()),
                "lift": r(decile.mean() / base, 2),
            }
        )
    return out


def subgroup_metrics(frame: pd.DataFrame, y: np.ndarray, p: np.ndarray, threshold: float, column: str) -> list[dict]:
    out = []
    for value, idx in frame.groupby(column, observed=True).indices.items():
        yy, pp = y[idx], p[idx]
        pred = pp >= threshold
        row = {
            "group": str(value),
            "n": int(len(idx)),
            "churn_rate": r(yy.mean()),
            "mean_predicted": r(pp.mean()),
            "recall": r(recall_score(yy, pred)) if yy.sum() else None,
            "precision": r(precision_score(yy, pred, zero_division=0)) if pred.sum() else None,
            "roc_auc": r(roc_auc_score(yy, pp)) if 0 < yy.sum() < len(yy) else None,
        }
        out.append(row)
    return out
