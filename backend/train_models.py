"""Train fraud detection models and persist artifacts.

This script expects a fraud-detection CSV dataset (e.g. PaySim synthetic
financial dataset) to reside under backend/data/creditcard.csv.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Tuple

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
DATA_PATH = Path(__file__).resolve().parent / "data" / "creditcard.csv"
BACKGROUND_SAMPLES = 500


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. Place creditcard.csv there."
        )
    return pd.read_csv(path)


def preprocess(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    target_col = None
    if "isFraud" in df.columns:
        target_col = "isFraud"
    elif "Class" in df.columns:
        target_col = "Class"
    if target_col is None:
        raise ValueError("Dataset must contain either 'isFraud' or 'Class'.")

    # Drop identifier / non-numeric columns
    drop_cols = [c for c in ["nameOrig", "nameDest", target_col] if c in df.columns]
    X = df.drop(columns=drop_cols)

    # One-hot encode transaction type when available
    if "type" in X.columns:
        X = pd.get_dummies(X, columns=["type"], prefix="type")

    y = df[target_col]
    return X, y


def train_models() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    df = load_dataset(DATA_PATH)

    # Sample down for memory / speed (stratified)
    if len(df) > 500_000:
        df = df.groupby("isFraud", group_keys=False).apply(
            lambda g: g.sample(min(len(g), 250_000), random_state=RANDOM_STATE)
        ).reset_index(drop=True)
        print(f"Sampled dataset to {len(df)} rows")

    X, y = preprocess(df)

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
        n_estimators=400,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.8,
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
        n_estimators=400,
        contamination=float(y.mean()),
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
        for column in X.columns
    }

    metadata = {
        "feature_columns": list(X.columns),
        "train_shape": list(X_train.shape),
        "test_shape": list(X_test.shape),
        "feature_stats": feature_stats,
    }
    (MODEL_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2))

    background = X_train_scaled[:BACKGROUND_SAMPLES]
    joblib.dump(background, MODEL_DIR / "background.pkl")

    print("Artifacts saved in", MODEL_DIR)


if __name__ == "__main__":
    train_models()
