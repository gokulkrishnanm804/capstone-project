"""Train fraud detection models from real transaction dataset."""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from app.config import settings

RANDOM_STATE = 42
TEST_SIZE = 0.2
MODEL_DIR = Path(__file__).resolve().parent / "models"
BACKGROUND_SAMPLES = 500
MIN_CONTAMINATION = 0.001
MAX_CONTAMINATION = 0.2
FEATURE_COLUMNS = [
    "amount",
    "is_new_beneficiary",
    "is_new_location",
    "is_night_transaction",
    "amount_vs_balance_ratio",
]


def _resolve_data_path() -> Path:
    configured_path = Path(settings.data_path)
    if configured_path.exists():
        return configured_path

    # Fallback to the dataset bundled in this repository.
    fallback = Path(__file__).resolve().parent / "data" / "PS_20174392719_1491204439457_log.csv"
    if fallback.exists():
        return fallback
    raise FileNotFoundError(
        "No dataset file found. Set DATA_PATH or place PS_20174392719_1491204439457_log.csv in backend/data/."
    )


def load_dataset(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {
        "step",
        "type",
        "amount",
        "nameOrig",
        "nameDest",
        "oldbalanceOrg",
        "isFraud",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {sorted(missing)}")
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    ordered = df.sort_values(["nameOrig", "step"]).copy()

    # First transfer to a beneficiary from the same sender behaves like "new beneficiary".
    ordered["is_new_beneficiary"] = (
        ordered.groupby(["nameOrig", "nameDest"]).cumcount() == 0
    ).astype(float)

    # First time a sender uses a transaction type is treated as unfamiliar behavior.
    ordered["is_new_location"] = (
        ordered.groupby(["nameOrig", "type"]).cumcount() == 0
    ).astype(float)

    hour_of_day = ordered["step"].astype(int) % 24
    ordered["is_night_transaction"] = ((hour_of_day >= 22) | (hour_of_day <= 5)).astype(float)

    old_balance = ordered["oldbalanceOrg"].clip(lower=1.0)
    ratio = (ordered["amount"] / old_balance) * 100.0
    ordered["amount_vs_balance_ratio"] = ratio.clip(lower=0.0, upper=1000.0)

    ordered["amount"] = ordered["amount"].astype(float).clip(lower=0.0)
    ordered["label"] = ordered["isFraud"].astype(int)
    return ordered[[*FEATURE_COLUMNS, "label"]]


def train_models() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    data_path = _resolve_data_path()
    raw = load_dataset(data_path)
    df = engineer_features(raw)

    X = df[FEATURE_COLUMNS]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    X_full_scaled = scaler.transform(X)

    joblib.dump(scaler, MODEL_DIR / "scaler.pkl")

    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_split=2,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    rf.fit(X_train_scaled, y_train)
    joblib.dump(rf, MODEL_DIR / "rf.pkl")

    fraud_ratio = max(float(y_train.mean()), 1e-4)
    scale_pos_weight = (1 - fraud_ratio) / fraud_ratio
    xgb_model = XGBClassifier(
        n_estimators=320,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.85,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=RANDOM_STATE,
        scale_pos_weight=scale_pos_weight,
        tree_method="hist",
        n_jobs=-1,
        reg_lambda=1.0,
    )
    xgb_model.fit(X_train_scaled, y_train)
    joblib.dump(xgb_model, MODEL_DIR / "xgb.pkl")

    contamination = float(min(max(y.mean(), MIN_CONTAMINATION), MAX_CONTAMINATION))
    iso = IsolationForest(
        n_estimators=320,
        contamination=contamination,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    iso.fit(X_train_scaled)
    joblib.dump(iso, MODEL_DIR / "iso.pkl")

    train_iso_raw = iso.decision_function(X_train_scaled)
    train_iso_scores = 1 / (1 + np.exp(train_iso_raw * 5))
    anomaly_threshold = float(np.quantile(train_iso_scores, 1 - contamination))

    feature_stats = {
        column: {
            "mean": float(X[column].mean()),
            "std": float(X[column].std() if not np.isnan(X[column].std()) else 0.0),
            "min": float(X[column].min()),
            "max": float(X[column].max()),
        }
        for column in FEATURE_COLUMNS
    }

    metadata = {
        "feature_columns": FEATURE_COLUMNS,
        "dataset_path": str(data_path),
        "train_shape": list(X_train.shape),
        "test_shape": list(X_test.shape),
        "feature_stats": feature_stats,
        "fraud_ratio": float(fraud_ratio),
        "samples": int(len(df)),
        "supervised_weights": {"random_forest": 0.5, "xgboost": 0.5},
        "anomaly": {
            "model": "IsolationForest",
            "contamination": contamination,
            "threshold": anomaly_threshold,
        },
    }
    (MODEL_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2))

    background = X_train_scaled[:BACKGROUND_SAMPLES]
    joblib.dump(background, MODEL_DIR / "background.pkl")

    print("Artifacts saved in", MODEL_DIR)
    print("Dataset:", data_path)
    print("Samples:", len(df), "Fraud ratio:", round(float(fraud_ratio), 6))
    print("Anomaly threshold:", round(anomaly_threshold, 6))


if __name__ == "__main__":
    train_models()
