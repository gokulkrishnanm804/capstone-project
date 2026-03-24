from __future__ import annotations

from datetime import datetime, date
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    upi_pin: str = Field(..., pattern=r"^\d{4,6}$")
    role: str = Field(default="user")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    has_upi_pin: bool
    is_blocked: bool = False


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
    transaction_time: str | None = Field(default=None)
    upi_pin: str | None = Field(default=None, pattern=r"^\d{4,6}$")
    mode: str = Field(default="send")


class SetUpiPinRequest(BaseModel):
    upi_pin: str = Field(..., pattern=r"^\d{4,6}$")


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
    cashback_earned: float
    timestamp: datetime
    risk_signals: RiskSignals
    prediction: PredictionBreakdown


class TransactionHistoryItem(BaseModel):
    transaction_id: str
    date: datetime
    amount: float
    counterparty: str
    direction: str
    transaction_type: str
    location: str
    device_type: str
    prediction: str
    risk_score: float


class AnalystTransactionItem(BaseModel):
    transaction_id: str
    date: datetime
    user_name: str
    user_email: EmailStr
    sender_account: str
    sender_name: str
    receiver_account: str
    receiver_name: str
    amount: float
    transaction_type: str
    location: str
    device_type: str
    prediction: str
    risk_score: float
    risk_rule_score: float
    random_forest_probability: float
    xgboost_probability: float
    isolation_forest_score: float
    is_new_location: bool
    is_new_device: bool
    is_night: bool
    rapid_sequence_count: int
    note: str
    shap_importance: list[FeatureImportance]
    feature_payload: dict[str, Any]


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
    direction: str | None = None


class RewardItem(BaseModel):
    transaction_id: str
    date: datetime
    transfer_amount: float
    cashback_amount: float
    counterparty: str
    reward_type: str


class RewardsSummaryResponse(BaseModel):
    total_cashback: float
    transaction_count: int
    first_bonus_awarded: bool
    rewards: list[RewardItem]


class FraudCaseResponse(BaseModel):
    case_id: str
    transaction_id: str
    user_id: int
    user_name: str
    user_email: EmailStr
    user_is_blocked: bool
    status: str
    severity: str
    reason_flags: dict[str, Any]
    analyst_notes: str
    admin_notes: str
    created_at: datetime
    updated_at: datetime


class FraudCaseReviewRequest(BaseModel):
    severity: str | None = None
    status: str | None = None
    analyst_notes: str | None = None
    escalate_to_admin: bool = False


class FraudCaseAdminActionRequest(BaseModel):
    status: str | None = None
    admin_notes: str | None = None
    block_user: bool = False
    unblock_user: bool = False
    block_reason: str | None = None


class BlockedQueryRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    message: str = Field(..., min_length=10, max_length=2000)
    case_id: str | None = None


class SupportQueryResponse(BaseModel):
    query_id: str
    user_id: int
    user_name: str
    user_email: EmailStr
    case_id: str | None = None
    query_type: str
    asked_by_user_id: int | None = None
    message: str
    user_response: str
    status: str
    analyst_notes: str
    admin_notes: str
    created_at: datetime
    updated_at: datetime


class SupportQueryUpdateRequest(BaseModel):
    status: str | None = None
    analyst_notes: str | None = None
    admin_notes: str | None = None


class AnalystUserQueryRequest(BaseModel):
    message: str = Field(..., min_length=10, max_length=2000)


class UserFraudQueryResponseRequest(BaseModel):
    user_response: str = Field(..., min_length=10, max_length=2000)
