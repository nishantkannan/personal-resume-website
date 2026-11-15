"""Loading, joining and auditing the raw data.

The customer file that started this project has the ten customer attributes but no
churn label. The label comes from the public, labelled release of the same dataset.
The two files describe the same 10,000 customers, so they are joined on
``CustomerId`` and every shared column is checked to agree before anything is used.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CUSTOMERS_CSV = DATA_DIR / "customers.csv"
LABELLED_CSV = DATA_DIR / "customer-churn-records-labelled.csv"

TARGET = "Exited"

# Identifiers: unique per row, carry no signal, and would let a model memorise customers.
ID_COLUMNS = ["RowNumber", "CustomerId", "Surname"]

# Leaks the label. In this data a complaint is recorded for 99.8% of churners and
# almost no one else, which points to it being logged at or after exit. A model that
# sees it scores ~0.998 ROC-AUC and is useless for predicting churn ahead of time.
LEAKY_COLUMNS = ["Complain"]


@dataclass(frozen=True)
class LoadedData:
    frame: pd.DataFrame
    customers_sha256: str
    labelled_sha256: str
    rows_in_customer_file: int
    rows_joined: int
    columns_checked: list[str]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(customers_csv: Path = CUSTOMERS_CSV, labelled_csv: Path = LABELLED_CSV) -> LoadedData:
    customers = pd.read_csv(customers_csv)
    labelled = pd.read_csv(labelled_csv)

    if customers["CustomerId"].duplicated().any() or labelled["CustomerId"].duplicated().any():
        raise ValueError("CustomerId is not unique; cannot join safely.")

    # RowNumber is file order, not an attribute, so it is not expected to agree.
    shared = [c for c in customers.columns if c in labelled.columns and c not in ("CustomerId", "RowNumber")]
    joined = customers.merge(labelled, on="CustomerId", how="inner", suffixes=("", "__labelled"), validate="one_to_one")
    if len(joined) != len(customers):
        raise ValueError(f"Only {len(joined)} of {len(customers)} customers found in the labelled file.")

    for col in shared:
        left, right = joined[col], joined[f"{col}__labelled"]
        mismatched = ~((left == right) | (left.isna() & right.isna()))
        if mismatched.any():
            raise ValueError(f"{mismatched.sum()} rows disagree on {col!r} between the two files.")

    joined = joined.drop(columns=[c for c in joined.columns if c.endswith("__labelled")])
    return LoadedData(
        frame=joined,
        customers_sha256=sha256(customers_csv),
        labelled_sha256=sha256(labelled_csv),
        rows_in_customer_file=len(customers),
        rows_joined=len(joined),
        columns_checked=shared,
    )


def audit(df: pd.DataFrame) -> dict:
    """Basic data-quality facts that the report shows next to the model."""
    return {
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "missing_cells": int(df.isna().sum().sum()),
        "duplicate_customers": int(df["CustomerId"].duplicated().sum()),
        "churn_rate": float(df[TARGET].mean()),
        "churners": int(df[TARGET].sum()),
    }
