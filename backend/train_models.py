"""Train fraud detection models using synthetic data aligned to app features."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

RANDOM_STATE = 42
TEST_SIZE = 0.2
MODEL_DIR = Path(__file__).resolve().parent / "models"
BACKGROUND_SAMPLES = 500
FEATURE_COLUMNS = [
    "amount",
    "is_new_beneficiary",
    "is_new_location",
    "is_night_transaction",
    "amount_vs_balance_ratio",
]


@dataclass
class SyntheticConfig:
    samples: int = 5_000
    fraud_ratio: float = 0.20
    currency_scale: tuple[float, float] = (200.0, 150_000.0)


def _clip(value: float, low: float, high: float) -> float:
    return float(max(low, min(high, value)))


def generate_synthetic_dataset(config: SyntheticConfig) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_STATE)
    n_fraud = int(config.samples * config.fraud_ratio)
    n_safe = config.samples - n_fraud

    rows = []

    # SAFE profiles: modest amounts, known beneficiary/location, day-time.
    for _ in range(n_safe):
        amount = rng.uniform(200, 45_000)
        ratio = _clip(rng.normal(18, 9), 0, 60)
        is_new_beneficiary = 0
        is_new_location = 0
        is_night = 1 if rng.random() < 0.08 else 0
        label = 0
        rows.append(
            [amount, is_new_beneficiary, is_new_location, is_night, ratio, label]
        )

    # FRAUD scenario A: high ratio + unfamiliar context.
    for _ in range(n_fraud // 2):
        base_balance = rng.uniform(40_000, 160_000)
        ratio = _clip(rng.uniform(70, 180), 60, 250)
        amount = _clip(base_balance * (ratio / 100), 10_000, config.currency_scale[1])
        is_new_beneficiary = 1
        is_new_location = 1 if rng.random() < 0.7 else 0
        is_night = 1 if rng.random() < 0.35 else 0
        label = 1
        rows.append(
            [amount, is_new_beneficiary, is_new_location, is_night, ratio, label]
        )

    # FRAUD scenario B: large night transfer to new beneficiary.
    for _ in range(n_fraud - (n_fraud // 2)):
        amount = rng.uniform(55_000, config.currency_scale[1])
        ratio = _clip(rng.uniform(65, 140), 60, 250)
        is_new_beneficiary = 1
        is_new_location = 1 if rng.random() < 0.4 else 0
        is_night = 1
        label = 1
        rows.append(
            [amount, is_new_beneficiary, is_new_location, is_night, ratio, label]
        )

    df = pd.DataFrame(rows, columns=[*FEATURE_COLUMNS, "label"])

    # Shuffle to avoid ordered blocks.
    df = df.sample(frac=1.0, random_state=RANDOM_STATE).reset_index(drop=True)
    return df


def train_models() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    config = SyntheticConfig()
    df = generate_synthetic_dataset(config)

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

    iso = IsolationForest(
        n_estimators=320,
        contamination=config.fraud_ratio,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    iso.fit(X_full_scaled)
    joblib.dump(iso, MODEL_DIR / "iso.pkl")

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
        "train_shape": list(X_train.shape),
        "test_shape": list(X_test.shape),
        "feature_stats": feature_stats,
        "fraud_ratio": float(fraud_ratio),
        "samples": config.samples,
    }
    (MODEL_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2))

    background = X_train_scaled[:BACKGROUND_SAMPLES]
    joblib.dump(background, MODEL_DIR / "background.pkl")

    print("Artifacts saved in", MODEL_DIR)


if __name__ == "__main__":
    train_models()
