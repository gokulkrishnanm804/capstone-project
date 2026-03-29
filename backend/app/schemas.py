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
    profile_image: str | None = None
    has_upi_pin: bool
    has_upi_details: bool = False
    has_card_details: bool = False
    has_account_details: bool = False
    status: str = "ACTIVE"
    is_blocked: bool = False
    has_mobile: bool = False
    has_card: bool = False
    mobile_last4: str | None = None
    card_last4: str | None = None
    mobile_number: str | None = None
    registered_card_number: str | None = None
    card_holder_name: str | None = None
    upi_id: str | None = None
    account_holder_name: str | None = None
    primary_account_number: str | None = None


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
    server_time_ist: datetime
    ip_city_guess: str
    beneficiary_status: dict[str, bool]


class SimulationTransactionRequest(BaseModel):
    sender_account: str | None = None
    receiver_account: str | None = None
    amount: float = Field(..., gt=0)
    transaction_type: str = Field(default="TRANSFER")
    location: str | None = Field(default=None)
    device_type: str = Field(default="Mobile")
    transaction_time: str | None = Field(default=None)
    geo_latitude: float | None = Field(default=None)
    geo_longitude: float | None = Field(default=None)
    geo_city: str | None = Field(default=None)
    mobile_number: str | None = Field(default=None, pattern=r"^\d{10}$")
    card_number: str | None = Field(default=None, pattern=r"^\d{12,19}$")
    upi_pin: str | None = Field(default=None, pattern=r"^\d{4,6}$")
    receiver_mobile_number: str | None = Field(default=None, pattern=r"^\d{10}$")
    receiver_upi_id: str | None = Field(default=None, pattern=r"^[\w\.-]{2,}@[A-Za-z]{2,}$")
    receiver_card_number: str | None = Field(default=None, pattern=r"^\d{12,19}$")
    receiver_card_holder_name: str | None = None
    receiver_account_holder_name: str | None = None
    suspicious_acknowledged: bool = False
    high_risk_query_message: str | None = Field(default=None, min_length=10, max_length=2000)
    mode: str = Field(default="send")


class UserContactUpdateRequest(BaseModel):
    mobile_number: str = Field(..., pattern=r"^\d{10}$")
    upi_id: str = Field(..., pattern=r"^[\w\.-]{2,}@[A-Za-z]{2,}$")
    account_holder_name: str = Field(..., min_length=2, max_length=120)
    # Card details are optional; when provided they must meet length constraints.
    card_number: str | None = Field(default=None, pattern=r"^(\d{12,19})?$")
    card_holder_name: str | None = Field(default=None, min_length=2, max_length=120)


class ProfileImageRequest(BaseModel):
    profile_image: str = Field(..., min_length=3, max_length=255)


class SetUpiPinRequest(BaseModel):
    upi_pin: str = Field(..., pattern=r"^\d{4,6}$")


class FeatureImportance(BaseModel):
    feature: str
    contribution: float
    label: str | None = None


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
    is_new_beneficiary: bool
    amount_vs_balance_ratio: float


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
    transfer_state: str = "EXECUTED"
    action_required: str | None = None
    risk_percentage: int
    pending_query_id: str | None = None
    pending_case_id: str | None = None
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


class AnalystTransactionListResponse(BaseModel):
    items: list[AnalystTransactionItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class AnalystDashboardAlert(BaseModel):
    transaction_id: str
    amount: float
    sender_name: str
    fraud_score: float
    prediction: str
    timestamp: datetime


class RiskyUserItem(BaseModel):
    user_id: int
    user_name: str
    transaction_count: int
    avg_fraud_score: float


class AnalystDashboardResponse(BaseModel):
    total_today: int
    flagged_today: int
    blocked_today: int
    safe_today: int
    fraud_trend: list[AnalyticsPoint]
    alerts: list[AnalystDashboardAlert]
    risky_users: list[RiskyUserItem]


class AnalystAlertListResponse(BaseModel):
    alerts: list[AnalystDashboardAlert]


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


class AnalystReportSummary(BaseModel):
    total_transactions: int
    fraud_count: int
    fraud_rate: float
    total_amount_transacted: float
    total_amount_blocked: float
    total_cashback_given: float
    top_flagged_user: str | None


class AnalystReportResponse(BaseModel):
    start_date: date
    end_date: date
    summary: AnalystReportSummary


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
    transaction_id: str | None = None
    transaction_amount: float | None = None
    transaction_risk_score: float | None = None
    transaction_prediction: str | None = None
    transaction_note: str | None = None
    created_at: datetime
    updated_at: datetime


class SupportQueryUpdateRequest(BaseModel):
    status: str | None = None
    analyst_notes: str | None = None
    admin_notes: str | None = None


class HighRiskDecisionRequest(BaseModel):
    decision: str = Field(..., pattern=r"^(ALLOW|DENY)$")
    admin_notes: str | None = Field(default=None, max_length=1000)


class AnalystUserQueryRequest(BaseModel):
    message: str = Field(..., min_length=10, max_length=2000)


class UserFraudQueryResponseRequest(BaseModel):
    user_response: str = Field(..., min_length=10, max_length=2000)


class HighRiskTransferItem(BaseModel):
    query_id: str
    transaction_id: str
    amount: float
    transaction_type: str
    receiver_name: str | None = None
    receiver_account: str | None = None
    risk_score: float
    risk_percentage: int
    status: str
    admin_message: str | None = None
    transaction_note: str
    created_at: datetime
    updated_at: datetime


class HighRiskTransferExecuteResponse(BaseModel):
    transaction_id: str
    executed: bool
    status: str
    message: str
    cashback_earned: float


class AnalystTransactionActionRequest(BaseModel):
    action: str = Field(..., pattern=r"^(confirm_fraud|mark_safe|escalate_admin)$")
    note: str | None = Field(default=None, max_length=1000)


class ModelPerformance(BaseModel):
    model: str
    accuracy: float
    precision: float
    recall: float
    f1: float


class TransactionTypeStat(BaseModel):
    type: str
    count: int


class ActivityLogItem(BaseModel):
    timestamp: datetime
    actor_role: str
    actor_name: str
    action: str
    target: str
    details: dict[str, Any] | None = None


class AdminOverviewResponse(BaseModel):
    total_users: int
    total_analysts: int
    total_transactions: int
    fraud_rate: float
    total_cashback: float
    system_status: str
    model_performance: list[ModelPerformance]
    fraud_trend: list[AnalyticsPoint]
    transaction_types: list[TransactionTypeStat]
    recent_activity: list[ActivityLogItem]


class AdminUserItem(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    profile_image: str | None = None
    account_number: str | None = None
    balance: float | None = None
    status: str
    join_date: datetime
    total_transactions: int
    fraud_flags: int


class AdminUserProfileResponse(BaseModel):
    user: AdminUserItem
    accounts: list[AccountResponse]
    transactions: list[TransactionHistoryItem]
    known_locations: list[str]


class AdminUpdateUserStatusRequest(BaseModel):
    status: str = Field(..., pattern=r"^(ACTIVE|SUSPENDED|DEACTIVATED)$")
    reason: str | None = Field(default=None, max_length=500)


class AdminOverrideRequest(BaseModel):
    status: str = Field(..., pattern=r"^(FRAUD|SUSPICIOUS|SAFE)$")
    reason: str | None = Field(default=None, max_length=500)


class ModelVersionItem(BaseModel):
    model_name: str
    version_label: str
    accuracy: float
    precision: float
    recall: float
    f1: float
    trained_at: datetime


class AdminModelResponse(BaseModel):
    metrics: list[ModelPerformance]
    shap_global: list[FeatureImportance]
    history: list[ModelVersionItem]
    retrain_status: str


class CashbackRuleItem(BaseModel):
    channel: str
    percentage: float
    cap_per_txn: float


class CashbackRuleUpdateRequest(BaseModel):
    channel: str
    percentage: float = Field(..., ge=0, le=100)


class CashbackCapUpdateRequest(BaseModel):
    cap_per_txn: float = Field(..., ge=0)


class CashbackDistributionItem(BaseModel):
    user_id: int
    name: str
    total_cashback: float


class AdminRewardsResponse(BaseModel):
    rules: list[CashbackRuleItem]
    distributions: list[CashbackDistributionItem]
    total_cashback: float


class ThresholdSetting(BaseModel):
    fraud_cutoff: float
    suspicious_cutoff: float


class VelocitySetting(BaseModel):
    max_transactions: int
    window_minutes: int


class BlacklistEntry(BaseModel):
    value: str
    type: str = Field(default="account_id")


class UpdateThresholdRequest(BaseModel):
    fraud_cutoff: float = Field(..., ge=0, le=1)
    suspicious_cutoff: float = Field(..., ge=0, le=1)


class UpdateVelocityRequest(BaseModel):
    max_transactions: int = Field(..., ge=1, le=1000)
    window_minutes: int = Field(..., ge=1, le=720)


class BlacklistRequest(BaseModel):
    value: str
    type: str = Field(default="account_id")


class AdminSettingsResponse(BaseModel):
    thresholds: ThresholdSetting
    velocity: VelocitySetting
    blacklist: list[BlacklistEntry]
    audit_logs: list[ActivityLogItem]
