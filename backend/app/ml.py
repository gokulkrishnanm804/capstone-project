from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
import shap
from sklearn.base import BaseEstimator

from .config import settings
from .schemas import FeatureImportance, TransactionFeatures


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
        self.feature_order: List[str] = metadata["feature_columns"]
        background_path = self.model_dir / "background.pkl"
        if background_path.exists():
            self.background = joblib.load(background_path)
        else:
            self.background = np.zeros((1, len(self.feature_order)))
        self.rf_explainer = shap.TreeExplainer(self.random_forest)
        self.xgb_explainer = shap.TreeExplainer(self.xgboost)

    def _vectorise(self, payload: TransactionFeatures) -> np.ndarray:
        values = [payload.features.get(feature, 0.0) for feature in self.feature_order]
        return np.asarray(values, dtype=float).reshape(1, -1)

    def predict(self, payload: TransactionFeatures) -> Dict[str, object]:
        raw_vector = self._vectorise(payload)
        scaled = self.scaler.transform(raw_vector)
        rf_prob = float(self.random_forest.predict_proba(scaled)[0][1])
        xgb_prob = float(self.xgboost.predict_proba(scaled)[0][1])
        iso_raw = float(self.isolation_forest.decision_function(scaled)[0])
        iso_score = float(1 / (1 + np.exp(iso_raw * 5)))
        final_score = 0.4 * rf_prob + 0.4 * xgb_prob + 0.2 * iso_score
        prediction = "FRAUD" if final_score > 0.5 else "NORMAL"
        importance = self._explain(scaled)
        transaction_id = uuid.uuid4().hex
        return {
            "transaction_id": transaction_id,
            "random_forest_probability": rf_prob,
            "xgboost_probability": xgb_prob,
            "isolation_forest_score": iso_score,
            "final_score": final_score,
            "prediction": prediction,
            "feature_importance": importance,
            "payload": raw_vector.tolist()[0],
        }

    def _explain(self, scaled: np.ndarray) -> List[FeatureImportance]:
        rf_values = self.rf_explainer.shap_values(scaled)
        if isinstance(rf_values, list):
            rf_values = rf_values[1]
        rf_values = rf_values[0]
        xgb_values = self.xgb_explainer.shap_values(scaled)
        if isinstance(xgb_values, list):
            xgb_values = xgb_values[0]
        xgb_values = xgb_values[0]
        combined = (np.abs(rf_values) + np.abs(xgb_values)) / 2
        importance = [
            FeatureImportance(feature=name, contribution=float(val))
            for name, val in zip(self.feature_order, combined)
        ]
        importance.sort(key=lambda item: abs(item.contribution), reverse=True)
        return importance[:10]


def get_model_service() -> ModelService:
    return ModelService()
