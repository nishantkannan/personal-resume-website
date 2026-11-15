"""Feature definitions and the preprocessing pipeline.

Everything that learns from data (scaling, encoding) lives inside a scikit-learn
Pipeline, so it is fitted on training folds only and cross-validation scores are not
inflated by information from the held-out rows.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

NUMERIC = [
    "CreditScore",
    "Age",
    "Tenure",
    "Balance",
    "NumOfProducts",
    "EstimatedSalary",
    "Satisfaction Score",
    "Point Earned",
]
BINARY = ["HasCrCard", "IsActiveMember"]
CATEGORICAL = ["Geography", "Gender", "Card Type"]
RAW_FEATURES = NUMERIC + BINARY + CATEGORICAL

# Derived features. Stateless (row-by-row), so they cannot leak across folds.
ENGINEERED = ["ZeroBalance", "BalanceToSalary"]

FEATURE_LABELS = {
    "CreditScore": "Credit score",
    "Age": "Age",
    "Tenure": "Tenure (years)",
    "Balance": "Balance",
    "NumOfProducts": "Products held",
    "EstimatedSalary": "Estimated salary",
    "Satisfaction Score": "Satisfaction score",
    "Point Earned": "Loyalty points",
    "HasCrCard": "Has credit card",
    "IsActiveMember": "Active member",
    "Geography": "Country",
    "Gender": "Gender",
    "Card Type": "Card type",
    "ZeroBalance": "Zero balance",
    "BalanceToSalary": "Balance ÷ salary",
}


def add_engineered(X: pd.DataFrame) -> pd.DataFrame:
    X = X.copy()
    X["ZeroBalance"] = (X["Balance"] == 0).astype(int)
    X["BalanceToSalary"] = X["Balance"] / X["EstimatedSalary"].clip(lower=1.0)
    return X


def make_preprocessor(scale: bool) -> Pipeline:
    numeric = NUMERIC + ENGINEERED
    num_step = StandardScaler() if scale else "passthrough"
    columns = ColumnTransformer(
        [
            ("num", num_step, numeric),
            ("bin", "passthrough", BINARY),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
        ],
        verbose_feature_names_out=False,
    )
    return Pipeline(
        [
            ("engineer", FunctionTransformer(add_engineered, feature_names_out=_engineered_names)),
            ("columns", columns),
        ]
    )


def _engineered_names(_transformer, input_features):
    return np.array(list(input_features) + ENGINEERED, dtype=object)


def source_feature(transformed_name: str) -> str:
    """Map a transformed column (e.g. ``Geography_Germany``) back to its source feature."""
    for cat in CATEGORICAL:
        if transformed_name.startswith(f"{cat}_"):
            return cat
    return transformed_name
