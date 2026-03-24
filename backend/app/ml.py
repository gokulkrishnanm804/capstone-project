from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import shap
from sklearn.base import BaseEstimator

from .config import settings
from .schemas import FeatureImportance


class ModelService:
    def __init__(self, model_dir: Path | None = None) -> None:
        self.model_dir = Path(model_dir or settings.model_dir)
        self.scaler = joblib.load(self.model_dir / "scaler.pkl")
        self.random_forest: BaseEstimator = joblib.load(self.model_dir / "rf.pkl")
        self.xgboost = joblib.load(self.model_dir / "xgb.pkl")
        self.isolation_forest = joblib.load(self.model_dir / "iso.pkl")

        metadata_path = self.model_dir / "metadata.json"
        if not metadata_path.exists():
            raise FileNotFoundError("metadata.json missing. Run train_models.py first.")

        metadata = json.loads(metadata_path.read_text())
        self.feature_order: list[str] = metadata.get("feature_columns", [])
        self.feature_stats: dict[str, dict[str, float]] = metadata.get("feature_stats", {})
        self.metadata: dict[str, Any] = metadata

        self.rf_explainer = shap.TreeExplainer(self.random_forest)
        self.xgb_explainer = shap.TreeExplainer(self.xgboost)

    def _vectorise_features(self, features: dict[str, float]) -> np.ndarray:
        values = [float(features.get(feature, 0.0)) for feature in self.feature_order]
        return np.asarray(values, dtype=float).reshape(1, -1)

    def _bounded(self, feature_name: str, value: float) -> float:
        stats = self.feature_stats.get(feature_name)
        if not stats:
            return float(value)
        minimum = stats.get("min")
        maximum = stats.get("max")
        if minimum is not None:
            value = max(value, float(minimum))
        if maximum is not None:
            value = min(value, float(maximum))
        return float(value)

    def build_feature_vector(
        self,
        *,
        amount: float,
        transaction_type: str,
        sender_balance: float,
        receiver_balance: float,
        risk_signals: dict[str, Any],
        timestamp: datetime,
        location: str,
        device_type: str,
    ) -> dict[str, float]:
        tx_type = transaction_type.upper()
        type_alias_map = {
            "UPI": "PAYMENT",
            "CARD": "DEBIT",
            "TRANSFER": "TRANSFER",
        }
        tx_type = type_alias_map.get(tx_type, tx_type)
        base = {
            feature: float(self.feature_stats.get(feature, {}).get("mean", 0.0))
            for feature in self.feature_order
        }

        location_seed = sum(ord(ch) for ch in location) % 97
        device_seed = sum(ord(ch) for ch in device_type) % 89
        hour = timestamp.hour
        step_proxy = ((timestamp.day - 1) * 24) + hour + 1

        # In PaySim-like datasets, flag is raised for very large transfer attempts.
        flagged_fraud_like = tx_type == "TRANSFER" and amount >= 200000

        for feature in self.feature_order:
            name = feature.lower()
            value = base[feature]

            if name == "amount":
                value = amount
            elif name in {"step", "hour"}:
                value = float(step_proxy if name == "step" else hour)
            elif name == "time":
                value = float(hour * 3600 + int(risk_signals["rapid_sequence_count"]) * 150)
            elif name in {"oldbalanceorg", "oldbalanceorig"}:
                value = sender_balance
            elif name in {"newbalanceorig", "newbalanceorg"}:
                value = max(sender_balance - amount, 0.0)
            elif name == "oldbalancedest":
                value = receiver_balance
            elif name == "newbalancedest":
                value = receiver_balance + amount
            elif name == "isflaggedfraud":
                value = 1.0 if flagged_fraud_like else 0.0
            elif name.startswith("type_"):
                value = 1.0 if name == f"type_{tx_type.lower()}" else 0.0
            elif name.startswith("v") and name[1:].isdigit():
                idx = int(name[1:])
                std = float(self.feature_stats.get(feature, {}).get("std", 1.0) or 1.0)
                directional = 1.0 if idx % 2 else -1.0
                seeded_noise = (((location_seed + device_seed + idx) % 13) - 6) / 20
                value = value + directional * std * risk_signals["rule_score"] * 0.8 + seeded_noise * std
            elif "risk" in name or "anomaly" in name or "velocity" in name:
                value = risk_signals["rule_score"]

            base[feature] = self._bounded(feature, value)

        return base

    def predict_from_features(self, features: dict[str, float]) -> dict[str, Any]:
        raw_vector = self._vectorise_features(features)
        scaled = self.scaler.transform(raw_vector)

        rf_prob = float(self.random_forest.predict_proba(scaled)[0][1])
        xgb_prob = float(self.xgboost.predict_proba(scaled)[0][1])
        iso_raw = float(self.isolation_forest.decision_function(scaled)[0])
        iso_score = float(1 / (1 + np.exp(iso_raw * 5)))

        fusion_score = 0.4 * rf_prob + 0.4 * xgb_prob + 0.2 * iso_score
        prediction = "FRAUD" if fusion_score >= 0.5 else "SAFE"

        importance = self._explain(scaled)
        transaction_id = uuid.uuid4().hex

        return {
            "transaction_id": transaction_id,
            "random_forest_probability": rf_prob,
            "xgboost_probability": xgb_prob,
            "isolation_forest_score": iso_score,
            "fusion_score": fusion_score,
            "fraud_probability": fusion_score,
            "prediction": prediction,
            "feature_importance": importance,
            "feature_payload": {f: float(features.get(f, 0.0)) for f in self.feature_order},
        }

    def explain_feature_payload(
        self,
        feature_payload: dict[str, float],
        top_n: int = 12,
    ) -> list[FeatureImportance]:
        raw_vector = self._vectorise_features(feature_payload)
        scaled = self.scaler.transform(raw_vector)
        return self._explain(scaled, top_n=top_n)

    def _explain(self, scaled: np.ndarray, top_n: int = 12) -> list[FeatureImportance]:
        rf_values = self.rf_explainer.shap_values(scaled)
        if isinstance(rf_values, list):
            rf_values = rf_values[1]
        rf_values = rf_values[0]

        xgb_values = self.xgb_explainer.shap_values(scaled)
        if isinstance(xgb_values, list):
            xgb_values = xgb_values[0]
        xgb_values = xgb_values[0]

        # Keep signed SHAP direction so UI can correctly show push-to-SAFE/FRAUD.
        combined = (rf_values + xgb_values) / 2
        importance = [
            FeatureImportance(feature=name, contribution=float(val))
            for name, val in zip(self.feature_order, combined)
        ]
        importance.sort(key=lambda item: abs(item.contribution), reverse=True)
        return importance[:top_n]


def get_model_service() -> ModelService:
    return ModelService()
