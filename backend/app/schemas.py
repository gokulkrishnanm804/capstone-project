from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="user")


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FeatureImportance(BaseModel):
    feature: str
    contribution: float


class TransactionFeatures(BaseModel):
    """Accepts arbitrary numeric features as a flat dict.
    The ML service validates that all required columns are present."""
    features: Dict[str, float]


class PredictionResponse(BaseModel):
    final_score: float
    prediction: str
    random_forest_probability: float
    xgboost_probability: float
    isolation_forest_score: float
    feature_importance: List[FeatureImportance]


class TransactionRecordResponse(BaseModel):
    transaction_id: str
    username: str
    fraud_probability: float
    xgb_probability: float
    isolation_score: float
    final_score: float
    prediction: str
    timestamp: datetime


class AnalyticsResponse(BaseModel):
    total_transactions: int
    fraud_detected: int
    fraud_percentage: float
    chart_data: List[Dict[str, Any]]
