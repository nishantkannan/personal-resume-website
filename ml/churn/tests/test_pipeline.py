"""Guards on the parts of the pipeline that silently ruin a model when they break."""

import numpy as np
import pandas as pd
import pytest

from churn import data
from churn.features import RAW_FEATURES, add_engineered, make_preprocessor, source_feature


@pytest.fixture(scope="module")
def frame() -> pd.DataFrame:
    return data.load().frame


def test_join_keeps_every_customer(frame):
    assert len(frame) == len(pd.read_csv(data.CUSTOMERS_CSV))
    assert frame["CustomerId"].is_unique


def test_join_rejects_disagreeing_files(tmp_path):
    customers = pd.read_csv(data.CUSTOMERS_CSV)
    customers.loc[0, "Age"] += 1
    path = tmp_path / "customers.csv"
    customers.to_csv(path, index=False)
    with pytest.raises(ValueError, match="Age"):
        data.load(customers_csv=path)


def test_label_is_binary(frame):
    assert set(frame[data.TARGET].unique()) == {0, 1}


def test_model_never_sees_ids_leaks_or_label():
    banned = set(data.ID_COLUMNS) | set(data.LEAKY_COLUMNS) | {data.TARGET}
    assert banned.isdisjoint(RAW_FEATURES)


def test_engineered_features_are_row_wise(frame):
    """Row-wise features cannot leak across folds: a row's output ignores the other rows."""
    X = frame[RAW_FEATURES]
    full = add_engineered(X).iloc[:50]
    alone = pd.concat([add_engineered(X.iloc[[i]]) for i in range(50)])
    pd.testing.assert_frame_equal(full, alone)


def test_preprocessor_handles_unseen_category(frame):
    X = frame[RAW_FEATURES].iloc[:200]
    prep = make_preprocessor(scale=True).fit(X)
    novel = X.iloc[:1].copy()
    novel["Geography"] = "Portugal"
    out = prep.transform(novel)
    assert np.isfinite(out).all()


def test_source_feature_maps_one_hot_columns():
    assert source_feature("Geography_Germany") == "Geography"
    assert source_feature("Card Type_GOLD") == "Card Type"
    assert source_feature("Age") == "Age"
