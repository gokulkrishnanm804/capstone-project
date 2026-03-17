from __future__ import annotations

from datetime import datetime, date
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="user")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class AccountResponse(BaseModel):
    account_number: str
    owner_name: str
    balance: float
    home_location: str


class SimulationContextResponse(BaseModel):
    sender_account: AccountResponse
    receivers: list[AccountResponse]
    known_locations: list[str]
    known_devices: list[str]


class SimulationTransactionRequest(BaseModel):
    sender_account: str | None = None
    receiver_account: str
    amount: float = Field(..., gt=0)
    transaction_type: str = Field(default="TRANSFER")
    location: str = Field(default="Delhi")
    device_type: str = Field(default="Mobile")
    mode: str = Field(default="send")


class FeatureImportance(BaseModel):
    feature: str
    contribution: float


class PredictionBreakdown(BaseModel):
    fraud_probability: float
    random_forest_probability: float
    xgboost_probability: float
    isolation_forest_score: float
    final_fusion_score: float
    risk_band: str
    prediction: str
    feature_importance: list[FeatureImportance]


class RiskSignals(BaseModel):
    amount_signal: float
    rapid_transfer_signal: float
    location_signal: float
    device_signal: float
    night_signal: float
    rule_score: float
    rapid_sequence_count: int
    is_new_location: bool
    is_new_device: bool
    is_night: bool


class TransactionExecutionResponse(BaseModel):
    transaction_id: str
    sender_account: AccountResponse
    receiver_account: AccountResponse
    transaction_type: str
    amount: float
    location: str
    device_type: str
    executed: bool
    note: str
    timestamp: datetime
    risk_signals: RiskSignals
    prediction: PredictionBreakdown


class TransactionHistoryItem(BaseModel):
    transaction_id: str
    date: datetime
    amount: float
    receiver: str
    transaction_type: str
    location: str
    device_type: str
    prediction: str
    risk_score: float


class AnalyticsPoint(BaseModel):
    label: str
    fraud: int
    normal: int


class RiskDistributionPoint(BaseModel):
    label: str
    value: int


class TransactionVolumePoint(BaseModel):
    label: str
    count: int


class AnalyticsResponse(BaseModel):
    total_users: int
    total_transactions: int
    fraud_detected: int
    fraud_percentage: float
    fraud_trend: list[AnalyticsPoint]
    risk_distribution: list[RiskDistributionPoint]
    transaction_volume: list[TransactionVolumePoint]


class ModelInsightResponse(BaseModel):
    fusion_formula: str
    supervised_models: list[str]
    unsupervised_models: list[str]
    threshold: float
    explanation: list[str]
    model_metadata: dict[str, Any]


class TransactionFilterParams(BaseModel):
    fraud_only: bool = False
    start_date: date | None = None
    end_date: date | None = None
