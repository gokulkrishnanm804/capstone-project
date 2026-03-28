from __future__ import annotations

import json
import re
import random
import threading
import statistics
import urllib.request
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
import joblib
from sqlalchemy import func, inspect, or_, text
from sqlalchemy.orm import Session, joinedload
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

from .auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    require_admin,
    verify_password,
)
import train_models as training_module
from .db import Base, engine, get_db
from .ml import get_model_service
from .models import (
    Account,
    AdminSetting,
    AuditLog,
    CashbackRule,
    FraudCase,
    ModelVersion,
    SupportQuery,
    Transaction,
    User,
)
from .schemas import (
    AccountResponse,
    ActivityLogItem,
    AdminModelResponse,
    AdminOverviewResponse,
    AdminOverrideRequest,
    AdminRewardsResponse,
    AdminSettingsResponse,
    AdminUpdateUserStatusRequest,
    AdminUserItem,
    AdminUserProfileResponse,
    AnalystAlertListResponse,
    AnalystDashboardAlert,
    AnalystDashboardResponse,
    AnalystReportResponse,
    AnalystReportSummary,
    AnalystTransactionActionRequest,
    AnalystTransactionItem,
    AnalystTransactionListResponse,
    AnalystUserQueryRequest,
    AnalyticsPoint,
    AnalyticsResponse,
    BlacklistEntry,
    BlacklistRequest,
    BlockedQueryRequest,
    CashbackCapUpdateRequest,
    CashbackDistributionItem,
    CashbackRuleItem,
    CashbackRuleUpdateRequest,
    FraudCaseAdminActionRequest,
    FraudCaseResponse,
    FraudCaseReviewRequest,
    FeatureImportance,
    HighRiskDecisionRequest,
    LoginRequest,
    ModelInsightResponse,
    ModelVersionItem,
    ModelPerformance,
    PredictionBreakdown,
    ProfileImageRequest,
    RegisterRequest,
    RewardItem,
    RewardsSummaryResponse,
    RiskDistributionPoint,
    RiskyUserItem,
    RiskSignals,
    ThresholdSetting,
    UserContactUpdateRequest,
    SetUpiPinRequest,
    SupportQueryResponse,
    SupportQueryUpdateRequest,
    SimulationContextResponse,
    SimulationTransactionRequest,
    TokenResponse,
    TransactionExecutionResponse,
    TransactionHistoryItem,
    TransactionTypeStat,
    TransactionVolumePoint,
    UpdateThresholdRequest,
    UpdateVelocityRequest,
    VelocitySetting,
    UserFraudQueryResponseRequest,
    UserProfile,
)

app = FastAPI(
    title="SentinelPay - Simulation-Based Explainable Multi-Model Fraud Detection System",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_service = None
training_job: dict[str, str] = {"status": "idle", "message": ""}
ALLOWED_PROFILE_IMAGES = {
    "sentinalpay - profile-image-1.avif",
    "sentinalpay - profile-image-2.avif",
    "sentinalpay - profile-image-3.jpg",
}


def _get_model_service():
    global model_service
    if model_service is None:
        model_service = get_model_service()
    return model_service


def _get_setting(db: Session, key: str, default):
    item = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    if item is None:
        return default
    try:
        return json.loads(item.value)
    except Exception:
        return default


def _set_setting(db: Session, key: str, value) -> None:
    payload = json.dumps(value)
    item = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    if item is None:
        item = AdminSetting(key=key, value=payload)
    else:
        item.value = payload
    db.add(item)
    db.commit()


def _primary_account_number(db: Session, user_id: int) -> str | None:
    account_row = (
        db.query(Account.account_number)
        .filter(Account.user_id == user_id)
        .order_by(Account.created_at.asc())
        .first()
    )
    return account_row[0] if account_row else None


def _last4(value: str | None) -> str | None:
    if not value:
        return None
    return value[-4:]


def _user_profile_from_user(db: Session, user: User) -> UserProfile:
    primary_account_number = _primary_account_number(db, user.id)
    has_mobile = bool(user.mobile_number)
    has_card = bool(user.registered_card_number)
    has_upi_details = bool(user.upi_id and user.mobile_number)
    has_card_details = bool(user.registered_card_number and user.card_holder_name)
    has_account_details = bool(primary_account_number and (user.account_holder_name or user.full_name))
    return UserProfile(
        id=user.id,
        name=user.full_name,
        email=user.email,
        role=user.role,
        profile_image=user.profile_image,
        has_upi_pin=bool(user.upi_pin_hash),
        has_upi_details=has_upi_details,
        has_card_details=has_card_details,
        has_account_details=has_account_details,
        status=user.status,
        is_blocked=user.is_blocked,
        has_mobile=has_mobile,
        has_card=has_card,
        mobile_last4=_last4(user.mobile_number),
        card_last4=_last4(user.registered_card_number),
        mobile_number=user.mobile_number,
        registered_card_number=user.registered_card_number,
        card_holder_name=user.card_holder_name,
        upi_id=user.upi_id,
        account_holder_name=user.account_holder_name or user.full_name,
        primary_account_number=primary_account_number,
    )


def _log_audit(
    db: Session,
    *,
    actor: User | None,
    action: str,
    target_type: str,
    target_id: str,
    details: dict | None = None,
) -> None:
    log = AuditLog(
        actor_user_id=actor.id if actor else None,
        actor_role=actor.role if actor else "system",
        actor_name=actor.full_name if actor else "System",
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details or {},
    )
    db.add(log)
    db.commit()


def _aggregate_shap_importance(db: Session, top_n: int = 10) -> list[FeatureImportance]:
    rows = db.query(Transaction.shap_importance).filter(Transaction.shap_importance.isnot(None)).order_by(Transaction.created_at.desc()).limit(600).all()
    agg: dict[str, float] = {}
    for (shap_map,) in rows:
        if not shap_map:
            continue
        for feature, value in shap_map.items():
            try:
                agg[feature] = agg.get(feature, 0.0) + abs(float(value))
            except Exception:
                continue
    ordered = sorted(agg.items(), key=lambda item: item[1], reverse=True)[:top_n]
    return [FeatureImportance(feature=feature, contribution=round(score, 4), label=feature) for feature, score in ordered]


def _latest_model_versions(db: Session) -> list[ModelVersion]:
    return (
        db.query(ModelVersion)
        .order_by(ModelVersion.trained_at.desc())
        .limit(30)
        .all()
    )


def _build_model_performance(db: Session) -> tuple[list[ModelPerformance], list[ModelVersionItem]]:
    versions = _latest_model_versions(db)
    metrics: list[ModelPerformance] = []
    history: list[ModelVersionItem] = []
    for version in versions:
        history.append(
            ModelVersionItem(
                model_name=version.model_name,
                version_label=version.version_label,
                accuracy=version.accuracy,
                precision=version.precision,
                recall=version.recall,
                f1=version.f1,
                trained_at=version.trained_at,
            )
        )
    by_model: dict[str, ModelVersion] = {}
    for version in versions:
        by_model.setdefault(version.model_name, version)
    for model_name in ["XGBoost", "RandomForest", "IsolationForest"]:
        entry = by_model.get(model_name)
        if entry:
            metrics.append(
                ModelPerformance(
                    model=model_name,
                    accuracy=entry.accuracy,
                    precision=entry.precision,
                    recall=entry.recall,
                    f1=entry.f1,
                )
            )
    if not metrics:
        metrics = [
            ModelPerformance(model="XGBoost", accuracy=0.92, precision=0.91, recall=0.9, f1=0.9),
            ModelPerformance(model="RandomForest", accuracy=0.9, precision=0.89, recall=0.88, f1=0.88),
            ModelPerformance(model="IsolationForest", accuracy=0.82, precision=0.8, recall=0.78, f1=0.79),
        ]
    return metrics, history


def _compute_training_metrics() -> dict[str, dict[str, float]]:
    df = training_module.generate_synthetic_dataset(training_module.SyntheticConfig())
    X = df[training_module.FEATURE_COLUMNS]
    y = df["label"]
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=training_module.TEST_SIZE,
        random_state=training_module.RANDOM_STATE,
        stratify=y,
    )

    scaler = joblib.load(training_module.MODEL_DIR / "scaler.pkl")
    X_test_scaled = scaler.transform(X_test)

    rf = joblib.load(training_module.MODEL_DIR / "rf.pkl")
    xgb_model = joblib.load(training_module.MODEL_DIR / "xgb.pkl")
    iso = joblib.load(training_module.MODEL_DIR / "iso.pkl")

    rf_pred = rf.predict(X_test_scaled)
    xgb_pred = xgb_model.predict(X_test_scaled)
    iso_pred_raw = iso.predict(scaler.transform(X_test))
    iso_pred = [1 if p == -1 else 0 for p in iso_pred_raw]

    def _metrics(y_true, preds):
        return {
            "accuracy": float(accuracy_score(y_true, preds)),
            "precision": float(precision_score(y_true, preds, zero_division=0)),
            "recall": float(recall_score(y_true, preds, zero_division=0)),
            "f1": float(f1_score(y_true, preds, zero_division=0)),
        }

    return {
        "XGBoost": _metrics(y_test, xgb_pred),
        "RandomForest": _metrics(y_test, rf_pred),
        "IsolationForest": _metrics(y_test, iso_pred),
    }


def _start_retrain_job() -> None:
    if training_job.get("status") == "running":
        return

    training_job.update({"status": "running", "message": "Retraining models"})

    def _job():
        with Session(bind=engine) as db:
            _set_setting(db, "retrain_status", "running")
            try:
                training_module.train_models()
                metrics = _compute_training_metrics()
                now = datetime.utcnow()
                for model_name, values in metrics.items():
                    version = ModelVersion(
                        model_name=model_name,
                        version_label=now.strftime("v%Y%m%d%H%M%S"),
                        accuracy=values["accuracy"],
                        precision=values["precision"],
                        recall=values["recall"],
                        f1=values["f1"],
                        trained_at=now,
                        meta={"source": "admin_retrain"},
                    )
                    db.add(version)
                db.commit()
                training_job.update({"status": "completed", "message": "Retrain completed"})
                _set_setting(db, "retrain_status", "idle")
            except Exception as exc:  # pragma: no cover - defensive
                training_job.update({"status": "failed", "message": str(exc)})
                _set_setting(db, "retrain_status", "failed")

    threading.Thread(target=_job, daemon=True).start()


def _audit_items(db: Session, limit: int = 50) -> list[ActivityLogItem]:
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ActivityLogItem(
            timestamp=log.created_at,
            actor_role=log.actor_role,
            actor_name=log.actor_name,
            action=log.action,
            target=f"{log.target_type}:{log.target_id}",
            details=log.details or {},
        )
        for log in logs
    ]


@app.get("/geo/ip-city")
def ip_city_lookup(request: Request):
    client_ip = _get_client_ip(request)
    ip_for_lookup = None
    if client_ip and client_ip not in {"127.0.0.1", "::1"}:
        ip_for_lookup = client_ip
    city = get_city_from_ip(ip_for_lookup)
    return {"city": city}


def _new_account_number() -> str:
    token = uuid.uuid4().hex[:10].upper()
    return f"FG{token}"


def _new_fraud_case_id() -> str:
    token = uuid.uuid4().hex[:10].upper()
    return f"CASE{token}"


def _new_support_query_id() -> str:
    token = uuid.uuid4().hex[:10].upper()
    return f"QRY{token}"


def _decimal_to_float(value: Decimal | float) -> float:
    return float(value) if isinstance(value, Decimal) else value


def _to_account_response(account: Account) -> AccountResponse:
    return AccountResponse(
        account_number=account.account_number,
        owner_name=account.owner_name,
        balance=round(_decimal_to_float(account.balance), 2),
        home_location=account.home_location,
    )


def _risk_band(score: float) -> str:
    if score < 0.3:
        return "LOW"
    if score < 0.6:
        return "MEDIUM"
    return "HIGH"


def _get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    client = request.client
    return client.host if client else None


def get_city_from_ip(ip_address: str | None = None) -> str:
    try:
        target = f"http://ip-api.com/json/{ip_address}" if ip_address else "http://ip-api.com/json/"
        with urllib.request.urlopen(target, timeout=3) as response:
            payload = response.read().decode("utf-8")
            data = json.loads(payload)
            return data.get("city") or "Unknown"
    except Exception:
        return "Unknown"


def _compute_high_amount_threshold(db: Session, current_user_id: int) -> float:
    amount_rows = (
        db.query(Transaction.amount)
        .filter(
            Transaction.user_id == current_user_id,
            Transaction.note.like("Transaction executed%"),
        )
        .order_by(Transaction.created_at.desc())
        .limit(120)
        .all()
    )
    amounts = [float(row[0]) for row in amount_rows]
    fallback_threshold = 25000.0
    if not amounts:
        return fallback_threshold

    if len(amounts) < 5:
        # Sparse history: set a dynamic but practical baseline from user's own max pattern.
        reference = max(max(amounts), statistics.fmean(amounts))
        return max(1000.0, reference * 2.5)

    ordered = sorted(amounts)
    p90_index = min(len(ordered) - 1, int(0.9 * (len(ordered) - 1)))
    p90 = ordered[p90_index]
    avg = statistics.fmean(amounts)
    deviation = statistics.pstdev(amounts) if len(amounts) > 1 else 0.0
    return max(2500.0, p90, avg + 2 * deviation)


def _resolve_transaction_datetime(transaction_time: str | None) -> datetime:
    local_tz = ZoneInfo("Asia/Kolkata")
    local_now = datetime.now(local_tz)
    if not transaction_time:
        return local_now

    # Accept frontend ISO timestamps as well as legacy hh:mm AM/PM values.
    try:
        iso_candidate = transaction_time.strip().replace("Z", "+00:00")
        iso_parsed = datetime.fromisoformat(iso_candidate)
        if iso_parsed.tzinfo is None:
            iso_parsed = iso_parsed.replace(tzinfo=local_tz)
        return iso_parsed.astimezone(local_tz)
    except ValueError:
        pass

    try:
        normalized = transaction_time.strip().upper().replace(".", "")
        parsed = datetime.strptime(normalized, "%I:%M %p")
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="transaction_time must be in hh:mm AM/PM format",
        ) from exc

    return local_now.replace(
        hour=parsed.hour,
        minute=parsed.minute,
        second=0,
        microsecond=0,
    )


VALID_CASE_STATUSES = {"NEW", "UNDER_REVIEW", "ESCALATED_TO_ADMIN", "ACTION_TAKEN", "CLOSED"}
VALID_CASE_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
VALID_QUERY_STATUSES = {"OPEN", "RESOLVED"}
VALID_QUERY_TYPES = {"USER_TO_TEAM", "ADMIN_TO_USER", "HIGH_RISK_TRANSFER"}


def _score_percentage(score: float) -> int:
    bounded = max(0.0, min(float(score), 1.0))
    return int(round(bounded * 100))


def _normalize_name(name: str | None) -> str:
    if not name:
        return ""
    return re.sub(r"[^a-z0-9]", "", name.strip().lower())


def _ensure_seed_data(db: Session) -> None:
    admin = db.query(User).filter(User.email == "admin@fraudguard.ai").first()
    if admin is None:
        admin = User(
            full_name="System Admin",
            email="admin@fraudguard.ai",
            hashed_password=get_password_hash("Admin@123"),
            role="admin",
        )
        db.add(admin)
        db.flush()
        db.add(
            Account(
                account_number=_new_account_number(),
                owner_name=admin.full_name,
                user_id=admin.id,
                balance=200000.00,
                home_location="Delhi",
                known_devices=["Desktop"],
            )
        )

    external_accounts = db.query(Account).filter(Account.user_id.is_(None)).count()
    if external_accounts < 4:
        seed_accounts = [
            ("City Market", "Mumbai"),
            ("Apex Electronics", "Bengaluru"),
            ("Northline Travels", "Kolkata"),
            ("Sunrise Retail", "Hyderabad"),
        ]
        for owner_name, home_location in seed_accounts:
            db.add(
                Account(
                    account_number=_new_account_number(),
                    owner_name=owner_name,
                    user_id=None,
                    balance=750000.0,
                    home_location=home_location,
                    known_devices=["POS"],
                )
            )

    if db.query(CashbackRule).count() == 0:
        defaults = [
            ("UPI", 2.0),
            ("CARD", 1.0),
            ("ACCOUNT_TRANSFER", 0.5),
        ]
        for channel, percent in defaults:
            db.add(
                CashbackRule(
                    channel=channel,
                    percentage=percent,
                    cap_per_txn=500.0,
                )
            )

    default_settings = {
        "thresholds": {"fraud_cutoff": 0.6, "suspicious_cutoff": 0.3},
        "velocity": {"max_transactions": 8, "window_minutes": 10},
        "blacklist": [],
        "retrain_status": "idle",
    }
    for key, value in default_settings.items():
        if db.query(AdminSetting).filter(AdminSetting.key == key).first() is None:
            db.add(AdminSetting(key=key, value=json.dumps(value)))
    db.commit()


def _ensure_schema_migrations() -> None:
    inspector = inspect(engine)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "status" not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'")
            )
        # Map legacy blocked users to suspended status for continuity.
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE users SET status='SUSPENDED' WHERE is_blocked=1")
            )
    if "upi_pin_hash" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN upi_pin_hash VARCHAR(255) NULL"))
    if "is_blocked" not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT FALSE")
            )
    if "blocked_reason" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN blocked_reason TEXT"))
    if "blocked_at" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN blocked_at DATETIME NULL"))
    if "blocked_by_user_id" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN blocked_by_user_id INTEGER NULL"))
    if "mobile_number" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN mobile_number VARCHAR(20) NULL"))
    if "registered_card_number" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN registered_card_number VARCHAR(25) NULL"))
    if "upi_id" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN upi_id VARCHAR(120) NULL"))
    if "card_holder_name" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN card_holder_name VARCHAR(120) NULL"))
    if "account_holder_name" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN account_holder_name VARCHAR(120) NULL"))
    if "profile_image" not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN profile_image VARCHAR(255)"
                    " DEFAULT 'sentinalpay - profile-image-1.avif'"
                )
            )

    transaction_columns = {
        column["name"] for column in inspector.get_columns("transactions")
    }
    if "cashback_amount" not in transaction_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE transactions ADD COLUMN cashback_amount FLOAT NOT NULL DEFAULT 0")
            )

    support_query_columns = {
        column["name"] for column in inspector.get_columns("support_queries")
    }
    if "query_type" not in support_query_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE support_queries ADD COLUMN query_type VARCHAR(30) NOT NULL DEFAULT 'USER_TO_TEAM'"
                )
            )
    if "asked_by_user_id" not in support_query_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE support_queries ADD COLUMN asked_by_user_id INTEGER NULL"))
    if "user_response" not in support_query_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE support_queries ADD COLUMN user_response TEXT NULL")
            )


@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_schema_migrations()
    # Warm-up model artifacts once at startup to avoid first-request delay.
    _get_model_service()
    with Session(bind=engine) as db:
        _ensure_seed_data(db)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/register", status_code=201)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if payload.role and payload.role.strip().lower() != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self registration is allowed only for user accounts",
        )

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    full_name = payload.name.strip()
    user = User(
        full_name=full_name,
        email=email,
        hashed_password=get_password_hash(payload.password),
        upi_pin_hash=get_password_hash(payload.upi_pin),
        role="user",
        account_holder_name=full_name,
    )
    db.add(user)
    db.flush()

    account = Account(
        account_number=_new_account_number(),
        owner_name=user.full_name,
        user_id=user.id,
        balance=120000.0,
        home_location="Delhi",
        known_devices=["Mobile"],
    )
    db.add(account)
    db.commit()

    return {
        "message": "User registered successfully",
        "account": _to_account_response(account).model_dump(),
    }


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.status.upper() in {"SUSPENDED", "DEACTIVATED"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCOUNT_BLOCKED",
                "msg": "Your account has been suspended. Contact support.",
            },
        )

    token = create_access_token(
        {
            "sub": user.email,
            "role": user.role,
            "name": user.full_name,
            "user_id": user.id,
        }
    )
    return TokenResponse(access_token=token, user=_user_profile_from_user(db, user))


@app.get("/me", response_model=UserProfile)
def current_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_profile_from_user(db, current_user)


@app.post("/set-upi-pin", status_code=200)
def set_upi_pin(
    payload: SetUpiPinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.upi_pin_hash = get_password_hash(payload.upi_pin)
    db.add(current_user)
    db.commit()
    return {"message": "UPI PIN set successfully"}


@app.post("/me/contact", response_model=UserProfile)
def update_contact_info(
    payload: UserContactUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.mobile_number = payload.mobile_number.strip()
    current_user.upi_id = payload.upi_id.strip().lower()
    current_user.account_holder_name = payload.account_holder_name.strip()
    if payload.card_number:
        current_user.registered_card_number = payload.card_number.strip()
        current_user.card_holder_name = (payload.card_holder_name or "").strip()
    primary_account = (
        db.query(Account)
        .filter(Account.user_id == current_user.id)
        .order_by(Account.created_at.asc())
        .first()
    )
    if primary_account:
        primary_account.owner_name = current_user.account_holder_name
        db.add(primary_account)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _user_profile_from_user(db, current_user)


@app.post("/me/profile-image", response_model=UserProfile)
def update_profile_image(
    payload: ProfileImageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = payload.profile_image.strip()
    if filename not in ALLOWED_PROFILE_IMAGES:
        raise HTTPException(status_code=400, detail="Invalid profile image selection")
    current_user.profile_image = filename
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _user_profile_from_user(db, current_user)


@app.post("/blocked-query", status_code=201)
def submit_blocked_query(payload: BlockedQueryRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_blocked:
        raise HTTPException(status_code=400, detail="Account is active. Query is only for blocked accounts.")

    fraud_case_id = None
    if payload.case_id:
        case = db.query(FraudCase).filter(FraudCase.case_id == payload.case_id.strip()).first()
        if case is None:
            raise HTTPException(status_code=404, detail="Fraud case not found")
        if case.user_id != user.id:
            raise HTTPException(status_code=403, detail="Case does not belong to this user")
        fraud_case_id = case.id

    support_query = SupportQuery(
        query_id=_new_support_query_id(),
        user_id=user.id,
        fraud_case_id=fraud_case_id,
        query_type="USER_TO_TEAM",
        asked_by_user_id=user.id,
        message=payload.message.strip(),
        user_response=payload.message.strip(),
        status="OPEN",
    )
    db.add(support_query)
    db.commit()
    return {"message": "Your query has been submitted to the admin team."}


@app.get("/simulation/context", response_model=SimulationContextResponse)
def simulation_context(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sender = (
        db.query(Account)
        .filter(Account.user_id == current_user.id)
        .order_by(Account.created_at.asc())
        .first()
    )
    if sender is None:
        raise HTTPException(status_code=404, detail="Sender account not found")

    # Show all user-created accounts first so newly registered users are always selectable.
    user_receivers = (
        db.query(Account)
        .filter(
            Account.account_number != sender.account_number,
            Account.user_id.is_not(None),
        )
        .order_by(Account.created_at.desc())
        .all()
    )
    external_receivers = (
        db.query(Account)
        .filter(
            Account.account_number != sender.account_number,
            Account.user_id.is_(None),
        )
        .order_by(Account.created_at.asc())
        .all()
    )
    receivers = [*user_receivers, *external_receivers]

    user_transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    known_locations = sorted({tx.location for tx in user_transactions if tx.location} | {sender.home_location})
    known_devices = sorted(set(sender.known_devices or ["Mobile"]))

    beneficiary_status: dict[str, bool] = {}
    for recv in receivers:
        beneficiary_history_count = (
            db.query(func.count(Transaction.id))
            .filter(
                Transaction.sender_account_id == sender.id,
                Transaction.receiver_account_id == recv.id,
                Transaction.note.like("Transaction executed%"),
            )
            .scalar()
            or 0
        )
        beneficiary_status[recv.account_number] = beneficiary_history_count == 0

    client_ip = _get_client_ip(request)
    ip_city_guess = get_city_from_ip(client_ip) if client_ip else "Unknown"
    server_time_ist = datetime.now(ZoneInfo("Asia/Kolkata"))

    return SimulationContextResponse(
        sender_account=_to_account_response(sender),
        receivers=[_to_account_response(account) for account in receivers],
        known_locations=known_locations,
        known_devices=known_devices,
        server_time_ist=server_time_ist,
        ip_city_guess=ip_city_guess,
        beneficiary_status=beneficiary_status,
    )


def _build_risk_signals(
    *,
    db: Session,
    current_user: User,
    sender: Account,
    receiver: Account,
    amount: float,
    location: str | None,
    device_type: str,
    mode: str,
    now: datetime,
) -> dict:
    normalized_location = location or "Unknown"
    recent_cutoff = now - timedelta(minutes=10)
    rapid_sequence_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.user_id == current_user.id, Transaction.created_at >= recent_cutoff)
        .scalar()
        or 0
    )

    previous_locations = {
        row[0]
        for row in db.query(Transaction.location)
        .filter(Transaction.user_id == current_user.id)
        .distinct()
        .all()
    }
    previous_devices = {
        row[0]
        for row in db.query(Transaction.device_type)
        .filter(Transaction.user_id == current_user.id)
        .distinct()
        .all()
    }

    previous_locations.add(sender.home_location)
    previous_devices.update(set(sender.known_devices or ["Mobile"]))

    is_new_location = normalized_location not in previous_locations

    beneficiary_history_count = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.sender_account_id == sender.id,
            Transaction.receiver_account_id == receiver.id,
            Transaction.note.like("Transaction executed%"),
        )
        .scalar()
        or 0
    )
    is_new_beneficiary = beneficiary_history_count == 0
    is_new_device = is_new_beneficiary

    # Evaluate night behavior in UPI-local timezone rather than server UTC.
    local_now = (
        now.astimezone(ZoneInfo("Asia/Kolkata"))
        if now.tzinfo
        else now.replace(tzinfo=timezone.utc).astimezone(ZoneInfo("Asia/Kolkata"))
    )
    is_night = local_now.hour >= 22 or local_now.hour <= 5

    current_balance = max(_decimal_to_float(sender.balance), 1.0)
    amount_signal = min(amount / current_balance, 1.0)
    amount_vs_balance_ratio = min((amount / current_balance) * 100, 1000.0)
    if amount >= 50000:
        amount_signal = max(amount_signal, 0.82)

    rapid_transfer_signal = min(rapid_sequence_count / 4, 1.0)
    location_signal = 1.0 if is_new_location else 0.08
    device_signal = 1.0 if is_new_beneficiary else 0.08
    night_signal = 0.85 if is_night else 0.12

    rule_score = (
        0.35 * amount_signal
        + 0.25 * rapid_transfer_signal
        + 0.15 * location_signal
        + 0.15 * device_signal
        + 0.10 * night_signal
    )
    if mode == "simulate":
        rule_score += 0.18
        if amount_signal >= 0.8:
            rule_score += 0.08
        if is_new_location and is_new_beneficiary:
            rule_score += 0.08
    rule_score = max(0.0, min(rule_score, 1.0))

    return {
        "amount_signal": amount_signal,
        "rapid_transfer_signal": rapid_transfer_signal,
        "location_signal": location_signal,
        "device_signal": device_signal,
        "night_signal": night_signal,
        "rule_score": rule_score,
        "rapid_sequence_count": int(rapid_sequence_count),
        "is_new_location": is_new_location,
        "is_new_device": is_new_device,
        "is_night": is_night,
        "is_new_beneficiary": is_new_beneficiary,
        "amount_vs_balance_ratio": float(amount_vs_balance_ratio),
    }


@app.post("/simulation/transaction", response_model=TransactionExecutionResponse)
def simulate_transaction(
    request: Request,
    payload: SimulationTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mode = payload.mode.lower()
    if mode not in {"send", "simulate"}:
        raise HTTPException(status_code=400, detail="mode must be send or simulate")

    tx_type = (payload.transaction_type or "").upper()
    is_upi = tx_type == "UPI"
    is_card = tx_type == "CARD"
    is_account_transfer = tx_type in {"TRANSFER", "ACCOUNT_TRANSFER"}

    def _digits(value: str | None) -> str:
        if not value:
            return ""
        return "".join(ch for ch in value if ch.isdigit())

    receiver: Account | None = None
    receiver_user: User | None = None

    if is_upi:
        if not payload.receiver_mobile_number or not payload.receiver_upi_id:
            raise HTTPException(status_code=400, detail="Receiver mobile and UPI ID are required for UPI transfers")
        receiver_user = (
            db.query(User)
            .filter(
                User.mobile_number == payload.receiver_mobile_number.strip(),
                func.lower(User.upi_id) == payload.receiver_upi_id.strip().lower(),
            )
            .first()
        )
        if receiver_user is None:
            raise HTTPException(status_code=404, detail="Receiver with provided UPI details not found")
        receiver_account_number = payload.receiver_account or _primary_account_number(db, receiver_user.id)
        if not receiver_account_number:
            raise HTTPException(status_code=404, detail="Receiver account not found for provided UPI details")
        receiver = db.query(Account).filter(Account.account_number == receiver_account_number).first()
        if receiver is None or receiver.user_id != receiver_user.id:
            raise HTTPException(status_code=404, detail="Receiver account does not match provided UPI details")

    elif is_card:
        if not payload.receiver_card_number or not payload.receiver_card_holder_name:
            raise HTTPException(status_code=400, detail="Receiver card number and card holder name are required for card transfers")
        receiver_card_digits = _digits(payload.receiver_card_number)
        name_lower = payload.receiver_card_holder_name.strip().lower()
        candidates = db.query(User).filter(User.registered_card_number.isnot(None)).all()
        for candidate in candidates:
            if _digits(candidate.registered_card_number) == receiver_card_digits and (candidate.card_holder_name or "").strip().lower() == name_lower:
                receiver_user = candidate
                break
        if receiver_user is None:
            raise HTTPException(status_code=404, detail="Receiver with provided card details not found")
        receiver_account_number = payload.receiver_account or _primary_account_number(db, receiver_user.id)
        if not receiver_account_number:
            raise HTTPException(status_code=404, detail="Receiver account not found for provided card details")
        receiver = db.query(Account).filter(Account.account_number == receiver_account_number).first()
        if receiver is None or receiver.user_id != receiver_user.id:
            raise HTTPException(status_code=404, detail="Receiver account does not match provided card details")

    else:
        if not payload.receiver_account:
            raise HTTPException(status_code=400, detail="Receiver account is required for transfers")
        receiver = db.query(Account).filter(Account.account_number == payload.receiver_account).first()
        if receiver is None:
            raise HTTPException(status_code=404, detail="Receiver account not found")
        if payload.receiver_account_holder_name:
            provided_name = payload.receiver_account_holder_name.strip()
            account_name = (receiver.owner_name or "").strip()
            provided_norm = _normalize_name(provided_name)
            account_norm = _normalize_name(account_name)
            if account_norm and provided_norm and account_norm != provided_norm:
                raise HTTPException(
                    status_code=400,
                    detail="Receiver account holder name does not match our records",
                )

    sender_query = db.query(Account).filter(Account.user_id == current_user.id)
    if payload.sender_account:
        sender_query = sender_query.filter(Account.account_number == payload.sender_account)
    sender = sender_query.order_by(Account.created_at.asc()).first()
    if sender is None:
        raise HTTPException(status_code=404, detail="Sender account not found")
    if receiver is None:
        raise HTTPException(status_code=404, detail="Receiver account not found")
    if receiver.account_number == sender.account_number:
        raise HTTPException(status_code=400, detail="Sender and receiver must be different")

    execute_transfer = mode == "send"
    sender_balance = _decimal_to_float(sender.balance)
    receiver_balance = _decimal_to_float(receiver.balance)

    if execute_transfer:
        if not current_user.upi_pin_hash:
            raise HTTPException(
                status_code=400,
                detail="UPI PIN is not set for this account. Set your UPI PIN before sending money.",
            )
        if not payload.upi_pin:
            raise HTTPException(status_code=400, detail="UPI PIN is required to send money")
        if not verify_password(payload.upi_pin, current_user.upi_pin_hash):
            raise HTTPException(status_code=400, detail="Invalid UPI PIN")

    if execute_transfer and payload.amount > sender_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    client_ip = _get_client_ip(request)
    ip_city_guess = get_city_from_ip(client_ip) if client_ip else "Unknown"
    server_now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
    server_now_naive = server_now_ist.replace(tzinfo=None)
    resolved_location = (
        payload.geo_city
        or payload.location
        or ip_city_guess
        or "Unknown"
    )
    now = server_now_ist
    observed_tx_time = _resolve_transaction_datetime(payload.transaction_time)

    velocity_settings = _get_setting(db, "velocity", {"max_transactions": 8, "window_minutes": 10})
    try:
        max_transactions = int(velocity_settings.get("max_transactions", 8))
        window_minutes = int(velocity_settings.get("window_minutes", 10))
    except Exception:
        max_transactions, window_minutes = 8, 10
    window_start = now - timedelta(minutes=window_minutes)
    recent_velocity = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.user_id == current_user.id, Transaction.created_at >= window_start)
        .scalar()
        or 0
    )
    if execute_transfer and recent_velocity >= max_transactions:
        raise HTTPException(
            status_code=429,
            detail="Velocity rule triggered: too many transactions in a short window",
        )

    risk_signals = _build_risk_signals(
        db=db,
        current_user=current_user,
        sender=sender,
        receiver=receiver,
        amount=payload.amount,
        location=resolved_location,
        device_type=payload.device_type,
        mode=mode,
        now=now,
    )

    # Respect client transaction timestamp for night-risk behavior without shifting
    # velocity windows to client-provided time.
    observed_is_night = observed_tx_time.hour >= 22 or observed_tx_time.hour <= 5
    risk_signals["is_night"] = observed_is_night
    risk_signals["night_signal"] = 0.85 if observed_is_night else 0.12
    recalculated_rule_score = (
        0.35 * risk_signals["amount_signal"]
        + 0.25 * risk_signals["rapid_transfer_signal"]
        + 0.15 * risk_signals["location_signal"]
        + 0.15 * risk_signals["device_signal"]
        + 0.10 * risk_signals["night_signal"]
    )
    if mode == "simulate":
        recalculated_rule_score += 0.18
        if risk_signals["amount_signal"] >= 0.8:
            recalculated_rule_score += 0.08
        if risk_signals["is_new_location"] and risk_signals["is_new_beneficiary"]:
            recalculated_rule_score += 0.08
    risk_signals["rule_score"] = max(0.0, min(recalculated_rule_score, 1.0))
    high_amount_threshold = _compute_high_amount_threshold(db, current_user.id)
    hard_rule_triggered = (
        execute_transfer
        and payload.amount >= high_amount_threshold
        and risk_signals["is_new_location"]
        and risk_signals["is_night"]
    )

    service = _get_model_service()
    mapped_features = service.build_feature_vector(
        amount=payload.amount,
        is_new_beneficiary=risk_signals["is_new_beneficiary"],
        is_new_location=risk_signals["is_new_location"],
        is_night_transaction=risk_signals["is_night"],
        amount_vs_balance_ratio=risk_signals["amount_vs_balance_ratio"],
    )
    model_result = service.predict_from_features(mapped_features)

    final_score = max(0.0, min(model_result["fusion_score"], 1.0))
    if hard_rule_triggered:
        final_score = max(final_score, 0.95)

    thresholds = _get_setting(db, "thresholds", {"fraud_cutoff": 0.6, "suspicious_cutoff": 0.3})
    fraud_cutoff = float(thresholds.get("fraud_cutoff", 0.6))
    suspicious_cutoff = float(thresholds.get("suspicious_cutoff", 0.3))
    fraud_cutoff = max(0.0, min(fraud_cutoff, 1.0))
    suspicious_cutoff = max(0.0, min(suspicious_cutoff, fraud_cutoff))

    if final_score >= fraud_cutoff:
        prediction = "FRAUD"
    elif final_score >= suspicious_cutoff:
        prediction = "SUSPICIOUS"
    else:
        prediction = "SAFE"
    risk_band = _risk_band(final_score)
    risk_percentage = _score_percentage(final_score)

    is_safe_transfer = risk_percentage <= 50
    is_suspicious_transfer = 51 <= risk_percentage <= 85
    is_high_fraud_transfer = risk_percentage >= 86

    if execute_transfer and is_suspicious_transfer and not payload.suspicious_acknowledged:
        return TransactionExecutionResponse(
            transaction_id=model_result["transaction_id"],
            sender_account=_to_account_response(sender),
            receiver_account=_to_account_response(receiver),
            transaction_type=payload.transaction_type,
            amount=payload.amount,
            location=resolved_location,
            device_type=payload.device_type,
            executed=False,
            note="Suspicious transaction detected. Confirm to continue.",
            cashback_earned=0.0,
            timestamp=server_now_ist,
            transfer_state="SUSPICIOUS_REVIEW",
            action_required="SUSPICIOUS_CONFIRMATION",
            risk_percentage=risk_percentage,
            risk_signals=RiskSignals(**risk_signals),
            prediction=PredictionBreakdown(
                fraud_probability=final_score,
                random_forest_probability=model_result["random_forest_probability"],
                xgboost_probability=model_result["xgboost_probability"],
                isolation_forest_score=model_result["isolation_forest_score"],
                final_fusion_score=final_score,
                risk_band=risk_band,
                prediction=prediction,
                feature_importance=model_result["feature_importance"],
            ),
        )

    if execute_transfer and is_high_fraud_transfer:
        query_message = (payload.high_risk_query_message or "").strip()
        if len(query_message) < 10:
            return TransactionExecutionResponse(
                transaction_id=model_result["transaction_id"],
                sender_account=_to_account_response(sender),
                receiver_account=_to_account_response(receiver),
                transaction_type=payload.transaction_type,
                amount=payload.amount,
                location=resolved_location,
                device_type=payload.device_type,
                executed=False,
                note="High fraud risk detected. Please contact admin with transaction details.",
                cashback_earned=0.0,
                timestamp=server_now_ist,
                transfer_state="BLOCKED_HIGH_RISK",
                action_required="CONTACT_ADMIN",
                risk_percentage=risk_percentage,
                risk_signals=RiskSignals(**risk_signals),
                prediction=PredictionBreakdown(
                    fraud_probability=final_score,
                    random_forest_probability=model_result["random_forest_probability"],
                    xgboost_probability=model_result["xgboost_probability"],
                    isolation_forest_score=model_result["isolation_forest_score"],
                    final_fusion_score=final_score,
                    risk_band=risk_band,
                    prediction=prediction,
                    feature_importance=model_result["feature_importance"],
                ),
            )

        pending_transaction = Transaction(
            transaction_id=model_result["transaction_id"],
            user_id=current_user.id,
            sender_account_id=sender.id,
            receiver_account_id=receiver.id,
            amount=payload.amount,
            cashback_amount=0.0,
            transaction_type=payload.transaction_type,
            location=resolved_location,
            device_type=payload.device_type,
            is_night=risk_signals["is_night"],
            is_new_location=risk_signals["is_new_location"],
            is_new_device=risk_signals["is_new_device"],
            rapid_sequence_count=risk_signals["rapid_sequence_count"],
            risk_rule_score=risk_signals["rule_score"],
            random_forest_probability=model_result["random_forest_probability"],
            xgboost_probability=model_result["xgboost_probability"],
            isolation_forest_score=model_result["isolation_forest_score"],
            final_score=final_score,
            prediction=prediction,
            shap_importance={
                item.feature: item.contribution for item in model_result["feature_importance"]
            },
            feature_payload=model_result["feature_payload"],
            note="Pending admin approval: high-risk transfer",
            created_at=server_now_naive,
        )
        db.add(pending_transaction)
        db.flush()

        fraud_case = FraudCase(
            case_id=_new_fraud_case_id(),
            transaction_id=pending_transaction.id,
            user_id=current_user.id,
            status="ESCALATED_TO_ADMIN",
            severity="CRITICAL" if hard_rule_triggered else "HIGH",
            reason_flags={
                "hard_rule_triggered": hard_rule_triggered,
                "amount": float(payload.amount),
                "high_amount_threshold": round(float(high_amount_threshold), 2),
                "is_new_location": risk_signals["is_new_location"],
                "is_night": risk_signals["is_night"],
                "is_new_device": risk_signals["is_new_device"],
                "rapid_sequence_count": risk_signals["rapid_sequence_count"],
                "rule_score": round(float(risk_signals["rule_score"]), 4),
                "final_score": round(float(final_score), 4),
                "risk_percentage": risk_percentage,
            },
            analyst_notes="High-risk transfer waiting for admin decision",
            admin_notes="",
        )
        db.add(fraud_case)
        db.flush()

        support_query = SupportQuery(
            query_id=_new_support_query_id(),
            user_id=current_user.id,
            fraud_case_id=fraud_case.id,
            query_type="HIGH_RISK_TRANSFER",
            asked_by_user_id=current_user.id,
            message=query_message,
            user_response="",
            status="OPEN",
            analyst_notes="Pending admin action: allow or deny transaction",
            admin_notes="",
        )
        db.add(support_query)
        db.commit()
        db.refresh(sender)
        db.refresh(receiver)

        return TransactionExecutionResponse(
            transaction_id=pending_transaction.transaction_id,
            sender_account=_to_account_response(sender),
            receiver_account=_to_account_response(receiver),
            transaction_type=payload.transaction_type,
            amount=payload.amount,
            location=resolved_location,
            device_type=payload.device_type,
            executed=False,
            note="High-risk transfer submitted to admin for approval.",
            cashback_earned=0.0,
            timestamp=server_now_ist,
            transfer_state="PENDING_ADMIN_APPROVAL",
            action_required="WAITING_ADMIN_DECISION",
            risk_percentage=risk_percentage,
            pending_query_id=support_query.query_id,
            pending_case_id=fraud_case.case_id,
            risk_signals=RiskSignals(**risk_signals),
            prediction=PredictionBreakdown(
                fraud_probability=final_score,
                random_forest_probability=model_result["random_forest_probability"],
                xgboost_probability=model_result["xgboost_probability"],
                isolation_forest_score=model_result["isolation_forest_score"],
                final_fusion_score=final_score,
                risk_band=risk_band,
                prediction=prediction,
                feature_importance=model_result["feature_importance"],
            ),
        )

    note = "Transaction executed"
    cashback_earned = 0.0
    if execute_transfer:
        previous_successful_transfers = (
            db.query(func.count(Transaction.id))
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.note.like("Transaction executed%"),
            )
            .scalar()
            or 0
        )
        cashback_earned = float(
            random.randint(21, 100)
            if previous_successful_transfers == 0
            else random.randint(1, 10)
        )

        sender.balance = _decimal_to_float(sender_balance - payload.amount + cashback_earned)
        receiver.balance = receiver_balance + payload.amount
        note = f"Transaction executed. Cashback credited: INR {cashback_earned:.2f}"
    else:
        note = "Simulation only: balances unchanged"

    sender_devices = list(sender.known_devices or [])
    if payload.device_type not in sender_devices:
        sender_devices.append(payload.device_type)
        sender.known_devices = sender_devices

    transaction = Transaction(
        transaction_id=model_result["transaction_id"],
        user_id=current_user.id,
        sender_account_id=sender.id,
        receiver_account_id=receiver.id,
        amount=payload.amount,
        cashback_amount=cashback_earned,
        transaction_type=payload.transaction_type,
        location=resolved_location,
        device_type=payload.device_type,
        is_night=risk_signals["is_night"],
        is_new_location=risk_signals["is_new_location"],
        is_new_device=risk_signals["is_new_device"],
        rapid_sequence_count=risk_signals["rapid_sequence_count"],
        risk_rule_score=risk_signals["rule_score"],
        random_forest_probability=model_result["random_forest_probability"],
        xgboost_probability=model_result["xgboost_probability"],
        isolation_forest_score=model_result["isolation_forest_score"],
        final_score=final_score,
        prediction=prediction,
        shap_importance={
            item.feature: item.contribution for item in model_result["feature_importance"]
        },
        feature_payload=model_result["feature_payload"],
        note=note,
        created_at=server_now_naive,
    )
    db.add(transaction)
    db.flush()

    if execute_transfer and prediction == "FRAUD":
        fraud_severity = "CRITICAL" if hard_rule_triggered else "HIGH"
        fraud_case = FraudCase(
            case_id=_new_fraud_case_id(),
            transaction_id=transaction.id,
            user_id=current_user.id,
            status="NEW",
            severity=fraud_severity,
            reason_flags={
                "hard_rule_triggered": hard_rule_triggered,
                "amount": float(payload.amount),
                "high_amount_threshold": round(float(high_amount_threshold), 2),
                "is_new_location": risk_signals["is_new_location"],
                "is_night": risk_signals["is_night"],
                "is_new_device": risk_signals["is_new_device"],
                "rapid_sequence_count": risk_signals["rapid_sequence_count"],
                "rule_score": round(float(risk_signals["rule_score"]), 4),
                "final_score": round(float(final_score), 4),
            },
            analyst_notes="",
            admin_notes="",
        )
        db.add(fraud_case)

    db.commit()
    db.refresh(sender)
    db.refresh(receiver)

    transfer_state = "EXECUTED" if execute_transfer else "SIMULATED"
    action_required = None
    if execute_transfer and is_safe_transfer:
        action_required = "NONE"

    return TransactionExecutionResponse(
        transaction_id=transaction.transaction_id,
        sender_account=_to_account_response(sender),
        receiver_account=_to_account_response(receiver),
        transaction_type=payload.transaction_type,
        amount=payload.amount,
        location=resolved_location,
        device_type=payload.device_type,
        executed=execute_transfer,
        note=note,
        cashback_earned=cashback_earned,
        timestamp=server_now_ist,
        transfer_state=transfer_state,
        action_required=action_required,
        risk_percentage=risk_percentage,
        risk_signals=RiskSignals(**risk_signals),
        prediction=PredictionBreakdown(
            fraud_probability=final_score,
            random_forest_probability=model_result["random_forest_probability"],
            xgboost_probability=model_result["xgboost_probability"],
            isolation_forest_score=model_result["isolation_forest_score"],
            final_fusion_score=final_score,
            risk_band=risk_band,
            prediction=prediction,
            feature_importance=model_result["feature_importance"],
        ),
    )


@app.get("/transactions", response_model=list[TransactionHistoryItem])
def list_transactions(
    fraud_only: bool = Query(False),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    direction: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account_ids = [
        row[0] for row in db.query(Account.id).filter(Account.user_id == current_user.id).all()
    ]
    if not account_ids:
        return []
    account_id_set = set(account_ids)

    query = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.sender_account),
            joinedload(Transaction.receiver_account),
        )
        .filter(
            or_(
                Transaction.sender_account_id.in_(account_ids),
                Transaction.receiver_account_id.in_(account_ids),
            )
        )
    )

    if fraud_only:
        query = query.filter(Transaction.prediction == "FRAUD")
    if start_date:
        query = query.filter(Transaction.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.filter(Transaction.created_at <= datetime.combine(end_date, time.max))

    direction_filter = direction.strip().upper() if direction else None
    if direction_filter not in {None, "CREDIT", "DEBIT"}:
        raise HTTPException(status_code=400, detail="direction must be CREDIT or DEBIT")
    if direction_filter == "CREDIT":
        query = query.filter(Transaction.receiver_account_id.in_(account_ids))
    if direction_filter == "DEBIT":
        query = query.filter(Transaction.sender_account_id.in_(account_ids))

    records = query.order_by(Transaction.created_at.desc()).limit(300).all()
    return [
        TransactionHistoryItem(
            transaction_id=row.transaction_id,
            date=row.created_at,
            amount=row.amount,
            counterparty=(
                row.sender_account.owner_name
                if row.receiver_account_id in account_id_set
                else row.receiver_account.owner_name
            ),
            direction=("CREDIT" if row.receiver_account_id in account_id_set else "DEBIT"),
            transaction_type=row.transaction_type,
            location=row.location,
            device_type=row.device_type,
            prediction=row.prediction,
            risk_score=row.final_score,
        )
        for row in records
    ]


@app.get("/rewards", response_model=RewardsSummaryResponse)
def rewards_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rewards_rows = (
        db.query(Transaction)
        .options(joinedload(Transaction.receiver_account))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.note.like("Transaction executed%"),
            Transaction.cashback_amount > 0,
        )
        .order_by(Transaction.created_at.desc())
        .limit(300)
        .all()
    )

    reward_items = [
        RewardItem(
            transaction_id=row.transaction_id,
            date=row.created_at,
            transfer_amount=row.amount,
            cashback_amount=round(row.cashback_amount, 2),
            counterparty=row.receiver_account.owner_name,
            reward_type="WELCOME CASHBACK" if row.cashback_amount >= 21 else "TRANSACTION CASHBACK",
        )
        for row in rewards_rows
    ]

    return RewardsSummaryResponse(
        total_cashback=round(sum(item.cashback_amount for item in reward_items), 2),
        transaction_count=len(reward_items),
        first_bonus_awarded=any(item.cashback_amount >= 21 for item in reward_items),
        rewards=reward_items,
    )


def _fraud_case_response(
    *,
    case: FraudCase,
    transaction_id: str,
    user_name: str,
    user_email: str,
    user_is_blocked: bool,
) -> FraudCaseResponse:
    return FraudCaseResponse(
        case_id=case.case_id,
        transaction_id=transaction_id,
        user_id=case.user_id,
        user_name=user_name,
        user_email=user_email,
        user_is_blocked=user_is_blocked,
        status=case.status,
        severity=case.severity,
        reason_flags=case.reason_flags,
        analyst_notes=case.analyst_notes,
        admin_notes=case.admin_notes,
        created_at=case.created_at,
        updated_at=case.updated_at,
    )


def _support_query_response(
    *,
    query: SupportQuery,
    user_name: str,
    user_email: str,
    case_id: str | None,
    transaction_id: str | None = None,
    transaction_amount: float | None = None,
    transaction_risk_score: float | None = None,
    transaction_prediction: str | None = None,
    transaction_note: str | None = None,
) -> SupportQueryResponse:
    return SupportQueryResponse(
        query_id=query.query_id,
        user_id=query.user_id,
        user_name=user_name,
        user_email=user_email,
        case_id=case_id,
        query_type=query.query_type,
        asked_by_user_id=query.asked_by_user_id,
        message=query.message,
        user_response=query.user_response,
        status=query.status,
        analyst_notes=query.analyst_notes,
        admin_notes=query.admin_notes,
        transaction_id=transaction_id,
        transaction_amount=transaction_amount,
        transaction_risk_score=transaction_risk_score,
        transaction_prediction=transaction_prediction,
        transaction_note=transaction_note,
        created_at=query.created_at,
        updated_at=query.updated_at,
    )


@app.get("/fraud-cases", response_model=list[FraudCaseResponse])
def list_fraud_cases(
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    query = (
        db.query(
            FraudCase,
            Transaction.transaction_id,
            User.full_name,
            User.email,
            User.is_blocked,
        )
        .join(Transaction, FraudCase.transaction_id == Transaction.id)
        .join(User, FraudCase.user_id == User.id)
    )

    if status_filter:
        normalized_status = status_filter.strip().upper()
        if normalized_status not in VALID_CASE_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid case status")
        query = query.filter(FraudCase.status == normalized_status)

    if severity:
        normalized_severity = severity.strip().upper()
        if normalized_severity not in VALID_CASE_SEVERITIES:
            raise HTTPException(status_code=400, detail="Invalid case severity")
        query = query.filter(FraudCase.severity == normalized_severity)

    rows = query.order_by(FraudCase.created_at.desc()).limit(limit).all()
    return [
        _fraud_case_response(
            case=case,
            transaction_id=transaction_id,
            user_name=user_name,
            user_email=user_email,
            user_is_blocked=user_is_blocked,
        )
        for case, transaction_id, user_name, user_email, user_is_blocked in rows
    ]


@app.patch("/fraud-cases/{case_id}/review", response_model=FraudCaseResponse)
def review_fraud_case(
    case_id: str,
    payload: FraudCaseReviewRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    case = db.query(FraudCase).filter(FraudCase.case_id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Fraud case not found")

    if payload.severity:
        normalized_severity = payload.severity.strip().upper()
        if normalized_severity not in VALID_CASE_SEVERITIES:
            raise HTTPException(status_code=400, detail="Invalid case severity")
        case.severity = normalized_severity

    if payload.status:
        normalized_status = payload.status.strip().upper()
        if normalized_status not in VALID_CASE_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid case status")
        if normalized_status == "ACTION_TAKEN" and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only admin can mark ACTION_TAKEN")
        case.status = normalized_status

    if payload.analyst_notes is not None:
        case.analyst_notes = payload.analyst_notes.strip()

    if payload.escalate_to_admin:
        case.status = "ESCALATED_TO_ADMIN"
        case.escalated_by_user_id = current_user.id

    db.add(case)
    db.commit()
    db.refresh(case)

    transaction_id = (
        db.query(Transaction.transaction_id)
        .filter(Transaction.id == case.transaction_id)
        .scalar()
    )
    user_details = (
        db.query(User.full_name, User.email, User.is_blocked)
        .filter(User.id == case.user_id)
        .first()
    )
    if transaction_id is None or user_details is None:
        raise HTTPException(status_code=404, detail="Case context not found")
    user_name, user_email, user_is_blocked = user_details
    return _fraud_case_response(
        case=case,
        transaction_id=transaction_id,
        user_name=user_name,
        user_email=user_email,
        user_is_blocked=user_is_blocked,
    )


@app.patch("/fraud-cases/{case_id}/admin-action", response_model=FraudCaseResponse)
def fraud_case_admin_action(
    case_id: str,
    payload: FraudCaseAdminActionRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    case = db.query(FraudCase).filter(FraudCase.case_id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Fraud case not found")
    target_user = db.query(User).filter(User.id == case.user_id).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail="Case user not found")

    if payload.block_user and payload.unblock_user:
        raise HTTPException(status_code=400, detail="Cannot block and unblock in same action")

    if payload.status:
        normalized_status = payload.status.strip().upper()
        if normalized_status not in VALID_CASE_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid case status")
        case.status = normalized_status

    if payload.block_user:
        affected = (
            db.query(User)
            .filter(User.id == case.user_id)
            .update(
                {
                    User.is_blocked: True,
                    User.status: "SUSPENDED",
                    User.blocked_reason: (payload.block_reason or "Blocked by admin after fraud review").strip(),
                    User.blocked_at: datetime.utcnow(),
                    User.blocked_by_user_id: current_user.id,
                },
                synchronize_session=False,
            )
        )
        if affected != 1:
            raise HTTPException(status_code=500, detail="Failed to block the selected user only")
        if not payload.status:
            case.status = "ACTION_TAKEN"

    if payload.unblock_user:
        affected = (
            db.query(User)
            .filter(User.id == case.user_id)
            .update(
                {
                    User.is_blocked: False,
                    User.status: "ACTIVE",
                    User.blocked_reason: "",
                    User.blocked_at: None,
                    User.blocked_by_user_id: None,
                },
                synchronize_session=False,
            )
        )
        if affected != 1:
            raise HTTPException(status_code=500, detail="Failed to unblock the selected user only")
        if not payload.status:
            case.status = "ACTION_TAKEN"

    if payload.admin_notes is not None:
        case.admin_notes = payload.admin_notes.strip()

    db.add(case)
    db.commit()
    db.refresh(case)

    transaction_id = (
        db.query(Transaction.transaction_id)
        .filter(Transaction.id == case.transaction_id)
        .scalar()
    )
    user_details = (
        db.query(User.full_name, User.email, User.is_blocked)
        .filter(User.id == case.user_id)
        .first()
    )
    if transaction_id is None or user_details is None:
        raise HTTPException(status_code=404, detail="Case context not found")
    user_name, user_email, user_is_blocked = user_details
    return _fraud_case_response(
        case=case,
        transaction_id=transaction_id,
        user_name=user_name,
        user_email=user_email,
        user_is_blocked=user_is_blocked,
    )


@app.get("/support-queries", response_model=list[SupportQueryResponse])
def list_support_queries(
    status_filter: str | None = Query(None, alias="status"),
    query_type: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    query = (
        db.query(
            SupportQuery,
            User.full_name,
            User.email,
            FraudCase.case_id,
            Transaction.transaction_id,
            Transaction.amount,
            Transaction.final_score,
            Transaction.prediction,
            Transaction.note,
        )
        .join(User, User.id == SupportQuery.user_id)
        .outerjoin(FraudCase, FraudCase.id == SupportQuery.fraud_case_id)
        .outerjoin(Transaction, Transaction.id == FraudCase.transaction_id)
    )

    if status_filter:
        normalized_status = status_filter.strip().upper()
        if normalized_status not in VALID_QUERY_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid query status")
        query = query.filter(SupportQuery.status == normalized_status)

    if query_type:
        normalized_type = query_type.strip().upper()
        if normalized_type not in VALID_QUERY_TYPES:
            raise HTTPException(status_code=400, detail="Invalid query type")
        query = query.filter(SupportQuery.query_type == normalized_type)

    rows = query.order_by(SupportQuery.created_at.desc()).limit(limit).all()
    return [
        _support_query_response(
            query=support_query,
            user_name=user_name,
            user_email=user_email,
            case_id=case_id_value,
            transaction_id=transaction_id,
            transaction_amount=float(amount) if amount is not None else None,
            transaction_risk_score=float(final_score) if final_score is not None else None,
            transaction_prediction=prediction,
            transaction_note=note,
        )
        for (
            support_query,
            user_name,
            user_email,
            case_id_value,
            transaction_id,
            amount,
            final_score,
            prediction,
            note,
        ) in rows
    ]


@app.patch("/support-queries/{query_id}", response_model=SupportQueryResponse)
def update_support_query(
    query_id: str,
    payload: SupportQueryUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    support_query = db.query(SupportQuery).filter(SupportQuery.query_id == query_id).first()
    if support_query is None:
        raise HTTPException(status_code=404, detail="Support query not found")

    if payload.status:
        normalized_status = payload.status.strip().upper()
        if normalized_status not in VALID_QUERY_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid query status")
        support_query.status = normalized_status

    if payload.analyst_notes is not None:
        support_query.analyst_notes = payload.analyst_notes.strip()
    if payload.admin_notes is not None:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only admin can update admin notes")
        support_query.admin_notes = payload.admin_notes.strip()

    db.add(support_query)
    db.commit()
    db.refresh(support_query)

    user_details = (
        db.query(User.full_name, User.email)
        .filter(User.id == support_query.user_id)
        .first()
    )
    if user_details is None:
        raise HTTPException(status_code=404, detail="Query context not found")
    case_id_value = None
    if support_query.fraud_case_id:
        case_id_value = (
            db.query(FraudCase.case_id)
            .filter(FraudCase.id == support_query.fraud_case_id)
            .scalar()
        )
    user_name, user_email = user_details
    return _support_query_response(
        query=support_query,
        user_name=user_name,
        user_email=user_email,
        case_id=case_id_value,
    )


@app.patch("/support-queries/{query_id}/high-risk-decision", response_model=SupportQueryResponse)
def decide_high_risk_transaction(
    query_id: str,
    payload: HighRiskDecisionRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    support_query = db.query(SupportQuery).filter(SupportQuery.query_id == query_id).first()
    if support_query is None:
        raise HTTPException(status_code=404, detail="Support query not found")
    if support_query.query_type != "HIGH_RISK_TRANSFER":
        raise HTTPException(status_code=400, detail="Query is not a high-risk transfer request")
    if support_query.status != "OPEN":
        raise HTTPException(status_code=409, detail="This high-risk query is already decided")
    if support_query.fraud_case_id is None:
        raise HTTPException(status_code=404, detail="Linked fraud case not found")

    fraud_case = db.query(FraudCase).filter(FraudCase.id == support_query.fraud_case_id).first()
    if fraud_case is None:
        raise HTTPException(status_code=404, detail="Linked fraud case not found")

    transaction = db.query(Transaction).filter(Transaction.id == fraud_case.transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Linked transaction not found")

    if not transaction.note.startswith("Pending admin approval"):
        raise HTTPException(status_code=409, detail="Transaction is not in pending-admin state")

    sender = db.query(Account).filter(Account.id == transaction.sender_account_id).first()
    receiver = db.query(Account).filter(Account.id == transaction.receiver_account_id).first()
    if sender is None or receiver is None:
        raise HTTPException(status_code=404, detail="Linked accounts not found")

    decision = payload.decision.strip().upper()
    admin_note = (payload.admin_notes or "").strip()
    timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    if decision == "ALLOW":
        sender_balance = _decimal_to_float(sender.balance)
        if transaction.amount > sender_balance:
            raise HTTPException(
                status_code=400,
                detail="Cannot allow transaction: sender balance is now insufficient",
            )

        historical_success = (
            db.query(func.count(Transaction.id))
            .filter(
                Transaction.user_id == transaction.user_id,
                Transaction.note.like("Transaction executed%"),
            )
            .scalar()
            or 0
        )
        cashback_earned = float(
            random.randint(21, 100)
            if historical_success == 0
            else random.randint(1, 10)
        )

        sender.balance = _decimal_to_float(sender_balance - transaction.amount + cashback_earned)
        receiver.balance = _decimal_to_float(receiver.balance) + transaction.amount
        transaction.cashback_amount = cashback_earned
        transaction.note = (
            f"Transaction executed after admin approval. Cashback credited: INR {cashback_earned:.2f}"
        )
        support_query.status = "RESOLVED"
        support_query.admin_notes = admin_note or "APPROVED: Transaction allowed by admin"
        support_query.analyst_notes = (
            f"ADMIN_DECISION=ALLOW; DECIDED_BY={current_user.id}; DECIDED_AT={timestamp}"
        )
        fraud_case.status = "ACTION_TAKEN"
        fraud_case.admin_notes = support_query.admin_notes

        _log_audit(
            db,
            actor=current_user,
            action="allow_high_risk_transaction",
            target_type="transaction",
            target_id=transaction.transaction_id,
            details={"query_id": support_query.query_id, "decision": "ALLOW"},
        )
    else:
        transaction.note = "Denied by admin: high-risk transaction was not approved"
        support_query.status = "RESOLVED"
        support_query.admin_notes = admin_note or "DENIED: Permission denied"
        support_query.analyst_notes = (
            f"ADMIN_DECISION=DENY; DECIDED_BY={current_user.id}; DECIDED_AT={timestamp}"
        )
        fraud_case.status = "ACTION_TAKEN"
        fraud_case.admin_notes = support_query.admin_notes

        _log_audit(
            db,
            actor=current_user,
            action="deny_high_risk_transaction",
            target_type="transaction",
            target_id=transaction.transaction_id,
            details={"query_id": support_query.query_id, "decision": "DENY"},
        )

    db.add(transaction)
    db.add(fraud_case)
    db.add(support_query)
    db.commit()
    db.refresh(support_query)
    db.refresh(transaction)

    user_details = (
        db.query(User.full_name, User.email)
        .filter(User.id == support_query.user_id)
        .first()
    )
    if user_details is None:
        raise HTTPException(status_code=404, detail="User context not found")
    user_name, user_email = user_details

    return _support_query_response(
        query=support_query,
        user_name=user_name,
        user_email=user_email,
        case_id=fraud_case.case_id,
        transaction_id=transaction.transaction_id,
        transaction_amount=float(transaction.amount),
        transaction_risk_score=float(transaction.final_score),
        transaction_prediction=transaction.prediction,
        transaction_note=transaction.note,
    )


@app.post("/fraud-cases/{case_id}/admin-query", response_model=SupportQueryResponse, status_code=201)
def create_user_query_from_admin(
    case_id: str,
    payload: AnalystUserQueryRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    case = db.query(FraudCase).filter(FraudCase.case_id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Fraud case not found")

    support_query = SupportQuery(
        query_id=_new_support_query_id(),
        user_id=case.user_id,
        fraud_case_id=case.id,
        query_type="ADMIN_TO_USER",
        asked_by_user_id=current_user.id,
        message=payload.message.strip(),
        user_response="",
        status="OPEN",
        analyst_notes=f"Requested by {current_user.role}",
    )
    db.add(support_query)
    db.commit()
    db.refresh(support_query)

    user_details = db.query(User.full_name, User.email).filter(User.id == case.user_id).first()
    if user_details is None:
        raise HTTPException(status_code=404, detail="User context not found")
    user_name, user_email = user_details
    return _support_query_response(
        query=support_query,
        user_name=user_name,
        user_email=user_email,
        case_id=case.case_id,
    )


@app.get("/my-fraud-queries", response_model=list[SupportQueryResponse])
def list_my_fraud_queries(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "user":
        raise HTTPException(status_code=403, detail="User access required")

    query = (
        db.query(
            SupportQuery,
            FraudCase.case_id,
            Transaction.transaction_id,
            Transaction.amount,
            Transaction.final_score,
            Transaction.prediction,
            Transaction.note,
        )
        .outerjoin(FraudCase, FraudCase.id == SupportQuery.fraud_case_id)
        .outerjoin(Transaction, Transaction.id == FraudCase.transaction_id)
        .filter(
            SupportQuery.user_id == current_user.id,
            SupportQuery.query_type.in_(["ADMIN_TO_USER", "HIGH_RISK_TRANSFER"]),
        )
    )

    if status_filter:
        normalized_status = status_filter.strip().upper()
        if normalized_status not in VALID_QUERY_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid query status")
        query = query.filter(SupportQuery.status == normalized_status)

    rows = query.order_by(SupportQuery.created_at.desc()).limit(limit).all()
    return [
        _support_query_response(
            query=support_query,
            user_name=current_user.full_name,
            user_email=current_user.email,
            case_id=case_id_value,
            transaction_id=transaction_id,
            transaction_amount=float(amount) if amount is not None else None,
            transaction_risk_score=float(final_score) if final_score is not None else None,
            transaction_prediction=prediction,
            transaction_note=note,
        )
        for (
            support_query,
            case_id_value,
            transaction_id,
            amount,
            final_score,
            prediction,
            note,
        ) in rows
    ]


@app.patch("/my-fraud-queries/{query_id}/respond", response_model=SupportQueryResponse)
def respond_my_fraud_query(
    query_id: str,
    payload: UserFraudQueryResponseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "user":
        raise HTTPException(status_code=403, detail="User access required")

    support_query = (
        db.query(SupportQuery)
        .filter(
            SupportQuery.query_id == query_id,
            SupportQuery.user_id == current_user.id,
            SupportQuery.query_type == "ADMIN_TO_USER",
        )
        .first()
    )
    if support_query is None:
        raise HTTPException(status_code=404, detail="Fraud query not found")

    support_query.user_response = payload.user_response.strip()
    support_query.status = "RESOLVED"
    db.add(support_query)
    db.commit()
    db.refresh(support_query)

    case_id_value = None
    if support_query.fraud_case_id:
        case_id_value = (
            db.query(FraudCase.case_id)
            .filter(FraudCase.id == support_query.fraud_case_id)
            .scalar()
        )

    return _support_query_response(
        query=support_query,
        user_name=current_user.full_name,
        user_email=current_user.email,
        case_id=case_id_value,
    )


@app.get("/fraud-analytics", response_model=AnalyticsResponse)
def fraud_analytics(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_transactions = db.query(func.count(Transaction.id)).scalar() or 0
    fraud_detected = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.prediction == "FRAUD")
        .scalar()
        or 0
    )
    fraud_percentage = round((fraud_detected / total_transactions * 100), 2) if total_transactions else 0.0

    since = datetime.utcnow() - timedelta(days=20)
    recent = (
        db.query(Transaction)
        .filter(Transaction.created_at >= since)
        .order_by(Transaction.created_at.asc())
        .all()
    )

    trend_map: dict[str, dict[str, int]] = {}
    for row in recent:
        label = row.created_at.strftime("%Y-%m-%d")
        if label not in trend_map:
            trend_map[label] = {"fraud": 0, "normal": 0}
        if row.prediction == "FRAUD":
            trend_map[label]["fraud"] += 1
        else:
            trend_map[label]["normal"] += 1

    fraud_trend = [
        AnalyticsPoint(label=label, fraud=values["fraud"], normal=values["normal"])
        for label, values in trend_map.items()
    ]

    risk_distribution = [
        RiskDistributionPoint(label="LOW", value=0),
        RiskDistributionPoint(label="MEDIUM", value=0),
        RiskDistributionPoint(label="HIGH", value=0),
    ]
    for row in recent:
        band = _risk_band(row.final_score)
        for item in risk_distribution:
            if item.label == band:
                item.value += 1
                break

    volume_rows = (
        db.query(Transaction.transaction_type, func.count(Transaction.id))
        .group_by(Transaction.transaction_type)
        .order_by(func.count(Transaction.id).desc())
        .all()
    )
    transaction_volume = [
        TransactionVolumePoint(label=label, count=count)
        for label, count in volume_rows
    ]

    return AnalyticsResponse(
        total_users=total_users,
        total_transactions=total_transactions,
        fraud_detected=fraud_detected,
        fraud_percentage=fraud_percentage,
        fraud_trend=fraud_trend,
        risk_distribution=risk_distribution,
        transaction_volume=transaction_volume,
    )


@app.get("/model-insights", response_model=ModelInsightResponse)
def model_insights(current_user: User = Depends(get_current_user)):
    _ = current_user
    service = _get_model_service()
    return ModelInsightResponse(
        fusion_formula="0.4 * RandomForest + 0.4 * XGBoost + 0.2 * IsolationForest",
        supervised_models=["Random Forest", "XGBoost"],
        unsupervised_models=["Isolation Forest"],
        threshold=0.5,
        explanation=[
            "Supervised models estimate fraud probability from labeled patterns.",
            "Isolation Forest detects anomalous behaviors in unlabeled space.",
            "Fusion balances precision and anomaly sensitivity for robust decisions.",
            "SHAP ranks the strongest contributors to each prediction.",
        ],
        model_metadata=service.metadata,
    )


def _analytics_date_bounds(days: int = 7) -> tuple[datetime, datetime]:
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    return start, end


@app.get("/admin/operations/dashboard", response_model=AnalystDashboardResponse)
def admin_operations_dashboard(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    today_start, today_end = _analytics_date_bounds(1)
    tx_query = db.query(Transaction).filter(
        Transaction.created_at >= today_start,
        Transaction.created_at <= today_end,
    )
    total_today = tx_query.count()
    flagged_today = tx_query.filter(Transaction.prediction.in_(["FRAUD", "SUSPICIOUS"])) .count()
    blocked_today = (
        db.query(User)
        .filter(User.is_blocked.is_(True), User.blocked_at >= today_start)
        .count()
    )
    safe_today = max(total_today - flagged_today, 0)

    # Trend last 7 days
    trend_start, trend_end = _analytics_date_bounds(7)
    recent = (
        db.query(Transaction)
        .filter(Transaction.created_at >= trend_start, Transaction.created_at <= trend_end)
        .order_by(Transaction.created_at.asc())
        .all()
    )
    trend_map: dict[str, dict[str, int]] = {}
    for row in recent:
        label = row.created_at.strftime("%Y-%m-%d")
        if label not in trend_map:
            trend_map[label] = {"fraud": 0, "normal": 0}
        if row.prediction in {"FRAUD", "SUSPICIOUS"}:
            trend_map[label]["fraud"] += 1
        else:
            trend_map[label]["normal"] += 1
    fraud_trend = [
        AnalyticsPoint(label=label, fraud=values["fraud"], normal=values["normal"])
        for label, values in sorted(trend_map.items())
    ]

    alerts_rows = (
        db.query(Transaction, User.full_name)
        .join(User, User.id == Transaction.user_id)
        .filter(Transaction.prediction.in_(["FRAUD", "SUSPICIOUS"]))
        .order_by(Transaction.created_at.desc())
        .limit(5)
        .all()
    )
    alerts = [
        AnalystDashboardAlert(
            transaction_id=tx.transaction_id,
            amount=tx.amount,
            sender_name=sender_name,
            fraud_score=tx.final_score,
            prediction=tx.prediction,
            timestamp=tx.created_at,
        )
        for tx, sender_name in alerts_rows
    ]

    risky_rows = (
        db.query(
            User.id,
            User.full_name,
            func.count(Transaction.id).label("txn_count"),
            func.avg(Transaction.final_score).label("avg_score"),
        )
        .join(Transaction, Transaction.user_id == User.id)
        .group_by(User.id, User.full_name)
        .order_by(func.avg(Transaction.final_score).desc())
        .limit(5)
        .all()
    )
    risky_users = [
        RiskyUserItem(
            user_id=row[0],
            user_name=row[1],
            transaction_count=int(row[2] or 0),
            avg_fraud_score=float(row[3] or 0.0),
        )
        for row in risky_rows
    ]

    return AnalystDashboardResponse(
        total_today=total_today,
        flagged_today=flagged_today,
        blocked_today=blocked_today,
        safe_today=safe_today,
        fraud_trend=fraud_trend,
        alerts=alerts,
        risky_users=risky_users,
    )


@app.get("/admin/operations/transactions", response_model=AnalystTransactionListResponse)
def admin_operations_transactions(
    status: str | None = Query(None, description="FRAUD|SUSPICIOUS|SAFE"),
    transaction_type: str | None = Query(None, description="UPI|CARD|TRANSFER|ACCOUNT_TRANSFER"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    min_amount: float | None = Query(None),
    max_amount: float | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_explanations: bool = Query(False),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    query = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.sender_account),
            joinedload(Transaction.receiver_account),
            joinedload(Transaction.user),
        )
    )

    if status:
        normalized_status = status.strip().upper()
        if normalized_status not in {"FRAUD", "SUSPICIOUS", "SAFE"}:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Transaction.prediction == normalized_status)

    if transaction_type:
        normalized_type = transaction_type.strip().upper()
        query = query.filter(Transaction.transaction_type == normalized_type)

    if start_date:
        query = query.filter(Transaction.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.filter(Transaction.created_at <= datetime.combine(end_date, time.max))
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Transaction.transaction_id.ilike(search_term),
                Transaction.note.ilike(search_term),
                Transaction.user.has(User.full_name.ilike(search_term)),
            )
        )

    total = query.count()
    total_pages = max((total + page_size - 1) // page_size, 1)
    offset = (page - 1) * page_size

    rows = (
        query.order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items: list[AnalystTransactionItem] = []
    service = _get_model_service() if include_explanations else None
    for row in rows:
        shap_items: list[FeatureImportance] = []
        feature_payload: dict[str, Any] = {}
        if include_explanations:
            try:
                if row.feature_payload:
                    shap_items = service.explain_feature_payload(row.feature_payload, top_n=12)
                    feature_payload = row.feature_payload or {}
            except Exception:
                shap_items = []
                feature_payload = row.feature_payload or {}
        items.append(
            AnalystTransactionItem(
                transaction_id=row.transaction_id,
                date=row.created_at,
                user_name=row.user.full_name,
                user_email=row.user.email,
                sender_account=row.sender_account.account_number,
                sender_name=row.sender_account.owner_name,
                receiver_account=row.receiver_account.account_number,
                receiver_name=row.receiver_account.owner_name,
                amount=row.amount,
                transaction_type=row.transaction_type,
                location=row.location,
                device_type=row.device_type,
                prediction=row.prediction,
                risk_score=row.final_score,
                risk_rule_score=row.risk_rule_score,
                random_forest_probability=row.random_forest_probability,
                xgboost_probability=row.xgboost_probability,
                isolation_forest_score=row.isolation_forest_score,
                is_new_location=row.is_new_location,
                is_new_device=row.is_new_device,
                is_night=row.is_night,
                rapid_sequence_count=row.rapid_sequence_count,
                note=row.note,
                shap_importance=shap_items,
                feature_payload=feature_payload,
            )
        )

    return AnalystTransactionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@app.get("/admin/operations/transactions/{transaction_id}", response_model=AnalystTransactionItem)
def admin_operations_transaction_detail(
    transaction_id: str,
    include_explanations: bool = Query(True),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    row = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.sender_account),
            joinedload(Transaction.receiver_account),
            joinedload(Transaction.user),
        )
        .filter(Transaction.transaction_id == transaction_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    shap_items: list[FeatureImportance] = []
    feature_payload: dict[str, Any] = {}
    if include_explanations:
        try:
            service = _get_model_service()
            if row.feature_payload:
                shap_items = service.explain_feature_payload(row.feature_payload, top_n=12)
                feature_payload = row.feature_payload or {}
        except Exception:
            shap_items = []
            feature_payload = row.feature_payload or {}

    return AnalystTransactionItem(
        transaction_id=row.transaction_id,
        date=row.created_at,
        user_name=row.user.full_name,
        user_email=row.user.email,
        sender_account=row.sender_account.account_number,
        sender_name=row.sender_account.owner_name,
        receiver_account=row.receiver_account.account_number,
        receiver_name=row.receiver_account.owner_name,
        amount=row.amount,
        transaction_type=row.transaction_type,
        location=row.location,
        device_type=row.device_type,
        prediction=row.prediction,
        risk_score=row.final_score,
        risk_rule_score=row.risk_rule_score,
        random_forest_probability=row.random_forest_probability,
        xgboost_probability=row.xgboost_probability,
        isolation_forest_score=row.isolation_forest_score,
        is_new_location=row.is_new_location,
        is_new_device=row.is_new_device,
        is_night=row.is_night,
        rapid_sequence_count=row.rapid_sequence_count,
        note=row.note,
        shap_importance=shap_items,
        feature_payload=feature_payload,
    )


@app.post("/admin/operations/transactions/{transaction_id}/action", response_model=AnalystTransactionItem)
def admin_operations_transaction_action(
    transaction_id: str,
    payload: AnalystTransactionActionRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row: Transaction | None = (
        db.query(Transaction)
        .options(joinedload(Transaction.sender_account), joinedload(Transaction.receiver_account), joinedload(Transaction.user))
        .filter(Transaction.transaction_id == transaction_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    note_suffix = payload.note.strip() if payload.note else None
    action = payload.action

    if action == "confirm_fraud":
        row.prediction = "FRAUD"
        row.final_score = max(row.final_score, 0.8)
    elif action == "mark_safe":
        row.prediction = "SAFE"
        row.final_score = min(row.final_score, 0.2)
    elif action == "escalate_admin":
        row.prediction = row.prediction or "SUSPICIOUS"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    if note_suffix:
        row.note = f"{row.note} | {note_suffix}" if row.note else note_suffix

    # Ensure fraud case exists when needed
    if action in {"confirm_fraud", "escalate_admin"}:
        case = db.query(FraudCase).filter(FraudCase.transaction_id == row.id).first()
        if case is None:
            case = FraudCase(
                case_id=_new_fraud_case_id(),
                transaction_id=row.id,
                user_id=row.user_id,
                status="NEW" if action == "confirm_fraud" else "ESCALATED_TO_ADMIN",
                severity="HIGH",
                reason_flags={
                    "amount": float(row.amount),
                    "final_score": float(row.final_score),
                    "prediction": row.prediction,
                },
                escalated_by_user_id=None,
            )
        if action == "escalate_admin":
            case.status = "ESCALATED_TO_ADMIN"
            case.severity = "HIGH"
            case.escalated_by_user_id = row.user_id
        db.add(case)

    db.add(row)
    db.commit()
    db.refresh(row)

    return admin_operations_transaction_detail(
        transaction_id=row.transaction_id,
        include_explanations=False,
        current_user=current_user,
        db=db,
    )


@app.get("/admin/operations/alerts", response_model=AnalystAlertListResponse)
def admin_operations_alerts(
    reviewed: bool | None = Query(None),
    limit: int = Query(30, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    query = (
        db.query(Transaction, User.full_name)
        .join(User, User.id == Transaction.user_id)
        .filter(Transaction.prediction.in_(["FRAUD", "SUSPICIOUS"]))
        .order_by(Transaction.created_at.desc())
    )
    rows = query.limit(limit).all()

    alerts: list[AnalystDashboardAlert] = []
    for tx, sender_name in rows:
        is_reviewed = "reviewed" in (tx.note or "").lower()
        if reviewed is not None and is_reviewed != reviewed:
            continue
        alerts.append(
            AnalystDashboardAlert(
                transaction_id=tx.transaction_id,
                amount=tx.amount,
                sender_name=sender_name,
                fraud_score=tx.final_score,
                prediction=tx.prediction,
                timestamp=tx.created_at,
            )
        )

    return AnalystAlertListResponse(alerts=alerts)


@app.post("/admin/operations/alerts/{transaction_id}/review")
def admin_operations_alert_review(
    transaction_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).first()
    if tx is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    marker = "Reviewed by admin"
    if marker.lower() not in (tx.note or "").lower():
        tx.note = f"{tx.note} | {marker}" if tx.note else marker
        db.add(tx)
        db.commit()
    return {"message": "Alert marked as reviewed"}


@app.get("/admin/operations/reports", response_model=AnalystReportResponse)
def admin_operations_reports(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    start = start_date or (today - timedelta(days=7))
    end = end_date or today

    query = db.query(Transaction).filter(
        Transaction.created_at >= datetime.combine(start, time.min),
        Transaction.created_at <= datetime.combine(end, time.max),
    )
    rows = query.all()
    total_transactions = len(rows)
    fraud_count = sum(1 for row in rows if row.prediction == "FRAUD")
    total_amount_blocked = round(sum(row.amount for row in rows if row.prediction == "FRAUD"), 2)
    fraud_rate = round((fraud_count / total_transactions * 100), 2) if total_transactions else 0.0

    user_scores: dict[int, list[float]] = {}
    for row in rows:
        user_scores.setdefault(row.user_id, []).append(row.final_score)
    top_flagged_user = None
    if user_scores:
        top_user_id = max(user_scores.items(), key=lambda item: sum(item[1]) / len(item[1]))[0]
        top_user = db.query(User.full_name).filter(User.id == top_user_id).scalar()
        top_flagged_user = top_user

    summary = AnalystReportSummary(
        total_transactions=total_transactions,
        fraud_count=fraud_count,
        fraud_rate=fraud_rate,
        total_amount_blocked=total_amount_blocked,
        top_flagged_user=top_flagged_user,
    )

    return AnalystReportResponse(start_date=start, end_date=end, summary=summary)


def _serialize_admin_user_item(
    *,
    user: User,
    account: Account | None,
    total_transactions: int,
    fraud_flags: int,
) -> AdminUserItem:
    return AdminUserItem(
        user_id=user.id,
        name=user.full_name,
        email=user.email,
        profile_image=user.profile_image,
        account_number=account.account_number if account else None,
        balance=float(account.balance) if account else None,
        status=user.status,
        join_date=user.created_at,
        total_transactions=total_transactions,
        fraud_flags=fraud_flags,
    )


@app.get("/admin/overview", response_model=AdminOverviewResponse)
def admin_overview(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del current_user
    total_users = db.query(User).filter(User.role == "user").count() or 0
    total_analysts = 0
    total_transactions = db.query(func.count(Transaction.id)).scalar() or 0
    fraud_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.prediction == "FRAUD")
        .scalar()
        or 0
    )
    total_cashback = (
        db.query(func.coalesce(func.sum(Transaction.cashback_amount), 0.0)).scalar()
        or 0.0
    )
    fraud_rate = round((fraud_count / total_transactions * 100), 2) if total_transactions else 0.0
    model_performance, _ = _build_model_performance(db)

    volume_rows = (
        db.query(Transaction.transaction_type, func.count(Transaction.id))
        .group_by(Transaction.transaction_type)
        .all()
    )
    volume_map = {label or "UNKNOWN": count for label, count in volume_rows}
    transaction_types = [
        TransactionTypeStat(type="UPI", count=int(volume_map.get("UPI", 0))),
        TransactionTypeStat(type="CARD", count=int(volume_map.get("CARD", 0))),
        TransactionTypeStat(type="ACCOUNT_TRANSFER", count=int(volume_map.get("ACCOUNT_TRANSFER", volume_map.get("TRANSFER", 0)))),
    ]

    recent_activity = _audit_items(db, limit=10)

    return AdminOverviewResponse(
        total_users=total_users,
        total_analysts=total_analysts,
        total_transactions=total_transactions,
        fraud_rate=fraud_rate,
        total_cashback=round(float(total_cashback), 2),
        system_status="ONLINE",
        model_performance=model_performance,
        transaction_types=transaction_types,
        recent_activity=recent_activity,
    )


@app.get("/admin/users", response_model=list[AdminUserItem])
def admin_users(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del current_user
    users = db.query(User).filter(User.role == "user").all()
    results: list[AdminUserItem] = []
    for user in users:
        account = (
            db.query(Account)
            .filter(Account.user_id == user.id)
            .order_by(Account.created_at.asc())
            .first()
        )
        txn_count = db.query(func.count(Transaction.id)).filter(Transaction.user_id == user.id).scalar() or 0
        fraud_flags = (
            db.query(func.count(FraudCase.id)).filter(FraudCase.user_id == user.id).scalar() or 0
        )
        results.append(
            _serialize_admin_user_item(
                user=user,
                account=account,
                total_transactions=txn_count,
                fraud_flags=fraud_flags,
            )
        )
    return results


@app.get("/admin/users/{user_id}", response_model=AdminUserProfileResponse)
def admin_user_profile(user_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del current_user
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    account = (
        db.query(Account)
        .filter(Account.user_id == user.id)
        .order_by(Account.created_at.asc())
        .first()
    )
    txn_rows = (
        db.query(Transaction)
        .options(joinedload(Transaction.receiver_account))
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(120)
        .all()
    )
    transactions = [
        TransactionHistoryItem(
            transaction_id=row.transaction_id,
            date=row.created_at,
            amount=row.amount,
            counterparty=row.receiver_account.owner_name if row.receiver_account else "",
            direction="DEBIT",
            transaction_type=row.transaction_type,
            location=row.location,
            device_type=row.device_type,
            prediction=row.prediction,
            risk_score=row.final_score,
        )
        for row in txn_rows
    ]
    locations = sorted({row.location for row in txn_rows if row.location})
    txn_count = len(txn_rows)
    fraud_flags = (
        db.query(func.count(FraudCase.id)).filter(FraudCase.user_id == user.id).scalar() or 0
    )
    user_item = _serialize_admin_user_item(
        user=user,
        account=account,
        total_transactions=txn_count,
        fraud_flags=fraud_flags,
    )
    return AdminUserProfileResponse(
        user=user_item,
        accounts=[_to_account_response(account)] if account else [],
        transactions=transactions,
        known_locations=locations,
    )


@app.patch("/admin/users/{user_id}/profile-image", response_model=AdminUserItem)
def admin_update_user_profile_image(
    user_id: int,
    payload: ProfileImageRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    filename = payload.profile_image.strip()
    if filename not in ALLOWED_PROFILE_IMAGES:
        raise HTTPException(status_code=400, detail="Invalid profile image selection")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot update admin profile image")
    user.profile_image = filename
    db.add(user)
    db.commit()
    return _serialize_admin_user_item(
        user=user,
        account=db.query(Account).filter(Account.user_id == user.id).order_by(Account.created_at.asc()).first(),
        total_transactions=db.query(func.count(Transaction.id)).filter(Transaction.user_id == user.id).scalar() or 0,
        fraud_flags=db.query(func.count(FraudCase.id)).filter(FraudCase.user_id == user.id).scalar() or 0,
    )


@app.patch("/admin/users/{user_id}/status", response_model=AdminUserItem)
def admin_update_user_status(
    user_id: int,
    payload: AdminUpdateUserStatusRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot change admin status")

    if user.status == "DEACTIVATED" and payload.status == "ACTIVE":
        raise HTTPException(status_code=400, detail="Deactivated users cannot be reactivated")

    user.status = payload.status
    user.is_blocked = payload.status in {"SUSPENDED", "DEACTIVATED"}
    user.blocked_reason = payload.reason or user.blocked_reason
    user.blocked_at = datetime.utcnow() if user.is_blocked else None
    user.blocked_by_user_id = current_user.id if user.is_blocked else None
    db.add(user)
    db.commit()
    db.refresh(user)

    _log_audit(
        db,
        actor=current_user,
        action="USER_STATUS_CHANGE",
        target_type="user",
        target_id=str(user.id),
        details={"status": payload.status, "reason": payload.reason},
    )

    account = (
        db.query(Account)
        .filter(Account.user_id == user.id)
        .order_by(Account.created_at.asc())
        .first()
    )
    txn_count = db.query(func.count(Transaction.id)).filter(Transaction.user_id == user.id).scalar() or 0
    fraud_flags = db.query(func.count(FraudCase.id)).filter(FraudCase.user_id == user.id).scalar() or 0
    return _serialize_admin_user_item(
        user=user,
        account=account,
        total_transactions=txn_count,
        fraud_flags=fraud_flags,
    )



@app.get("/admin/transactions", response_model=AnalystTransactionListResponse)
def admin_transactions(
    status: str | None = Query(None),
    transaction_type: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    min_amount: float | None = Query(None),
    max_amount: float | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    del current_user
    return admin_operations_transactions(
        status=status,
        transaction_type=transaction_type,
        start_date=start_date,
        end_date=end_date,
        min_amount=min_amount,
        max_amount=max_amount,
        search=search,
        page=page,
        page_size=page_size,
        include_explanations=True,
        current_user=db.query(User).filter(User.role == "admin").first() or User(),
        db=db,
    )


@app.post("/admin/transactions/{transaction_id}/override", response_model=AnalystTransactionItem)
def admin_override_transaction(
    transaction_id: str,
    payload: AdminOverrideRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tx: Transaction | None = (
        db.query(Transaction)
        .options(joinedload(Transaction.sender_account), joinedload(Transaction.receiver_account), joinedload(Transaction.user))
        .filter(Transaction.transaction_id == transaction_id)
        .first()
    )
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.prediction = payload.status
    tx.final_score = 0.9 if payload.status == "FRAUD" else 0.5 if payload.status == "SUSPICIOUS" else 0.05
    reason_note = payload.reason.strip() if payload.reason else "Admin override"
    tx.note = f"{tx.note} | {reason_note}" if tx.note else reason_note
    db.add(tx)

    case = db.query(FraudCase).filter(FraudCase.transaction_id == tx.id).first()
    if payload.status == "FRAUD":
        if case is None:
            case = FraudCase(
                case_id=_new_fraud_case_id(),
                transaction_id=tx.id,
                user_id=tx.user_id,
                status="ACTION_TAKEN",
                severity="HIGH",
                reason_flags={"admin_override": True, "prediction": payload.status},
                analyst_notes="",
                admin_notes=reason_note,
            )
        else:
            case.status = "ACTION_TAKEN"
            case.admin_notes = reason_note
        db.add(case)

    db.commit()
    _log_audit(
        db,
        actor=current_user,
        action="ADMIN_OVERRIDE",
        target_type="transaction",
        target_id=transaction_id,
        details={"status": payload.status, "reason": payload.reason},
    )

    return admin_operations_transaction_detail(
        transaction_id=transaction_id,
        include_explanations=False,
        db=db,
        current_user=current_user,
    )


@app.get("/admin/models", response_model=AdminModelResponse)
def admin_models(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del current_user
    metrics, history = _build_model_performance(db)
    shap_global = _aggregate_shap_importance(db)
    retrain_status = _get_setting(db, "retrain_status", "idle")
    return AdminModelResponse(
        metrics=metrics,
        shap_global=shap_global,
        history=history,
        retrain_status=retrain_status,
    )


@app.post("/admin/models/retrain")
def admin_models_retrain(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del db
    _start_retrain_job()
    return {"status": training_job.get("status"), "message": training_job.get("message")}


@app.get("/admin/rewards", response_model=AdminRewardsResponse)
def admin_rewards(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del current_user
    rules = db.query(CashbackRule).order_by(CashbackRule.channel.asc()).all()
    distributions: list[CashbackDistributionItem] = []
    total_cashback = 0.0
    user_cashback = (
        db.query(User.id, User.full_name, func.coalesce(func.sum(Transaction.cashback_amount), 0.0))
        .join(Transaction, Transaction.user_id == User.id)
        .group_by(User.id, User.full_name)
        .all()
    )
    for user_id, name, amount in user_cashback:
        total_cashback += float(amount)
        distributions.append(
            CashbackDistributionItem(
                user_id=user_id,
                name=name,
                total_cashback=round(float(amount), 2),
            )
        )
    rule_items = [
        CashbackRuleItem(channel=row.channel, percentage=row.percentage, cap_per_txn=row.cap_per_txn)
        for row in rules
    ]
    return AdminRewardsResponse(
        rules=rule_items,
        distributions=distributions,
        total_cashback=round(total_cashback, 2),
    )


@app.patch("/admin/rewards/rules", response_model=list[CashbackRuleItem])
def admin_update_cashback_rule(
    payload: CashbackRuleUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rule = db.query(CashbackRule).filter(CashbackRule.channel == payload.channel.upper()).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.percentage = payload.percentage
    db.add(rule)
    db.commit()
    _log_audit(
        db,
        actor=current_user,
        action="UPDATE_CASHBACK_RULE",
        target_type="cashback_rule",
        target_id=rule.channel,
        details={"percentage": payload.percentage},
    )
    updated = db.query(CashbackRule).order_by(CashbackRule.channel.asc()).all()
    return [
        CashbackRuleItem(channel=row.channel, percentage=row.percentage, cap_per_txn=row.cap_per_txn)
        for row in updated
    ]


@app.patch("/admin/rewards/cap", response_model=list[CashbackRuleItem])
def admin_update_cashback_cap(
    payload: CashbackCapUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rules = db.query(CashbackRule).all()
    for rule in rules:
        rule.cap_per_txn = payload.cap_per_txn
        db.add(rule)
    db.commit()
    _log_audit(
        db,
        actor=current_user,
        action="UPDATE_CASHBACK_CAP",
        target_type="cashback_cap",
        target_id="all",
        details={"cap_per_txn": payload.cap_per_txn},
    )
    updated = db.query(CashbackRule).order_by(CashbackRule.channel.asc()).all()
    return [
        CashbackRuleItem(channel=row.channel, percentage=row.percentage, cap_per_txn=row.cap_per_txn)
        for row in updated
    ]


@app.get("/admin/settings", response_model=AdminSettingsResponse)
def admin_settings(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del current_user
    thresholds = _get_setting(db, "thresholds", {"fraud_cutoff": 0.6, "suspicious_cutoff": 0.3})
    velocity = _get_setting(db, "velocity", {"max_transactions": 8, "window_minutes": 10})
    blacklist_raw = _get_setting(db, "blacklist", [])
    blacklist = [
        BlacklistEntry(value=item.get("value"), type=item.get("type", "account_id"))
        for item in blacklist_raw
        if isinstance(item, dict) and item.get("value")
    ]
    logs = _audit_items(db, limit=50)
    return AdminSettingsResponse(
        thresholds=ThresholdSetting(
            fraud_cutoff=float(thresholds.get("fraud_cutoff", 0.6)),
            suspicious_cutoff=float(thresholds.get("suspicious_cutoff", 0.3)),
        ),
        velocity=VelocitySetting(
            max_transactions=int(velocity.get("max_transactions", 8)),
            window_minutes=int(velocity.get("window_minutes", 10)),
        ),
        blacklist=blacklist,
        audit_logs=logs,
    )


@app.post("/admin/settings/thresholds", response_model=ThresholdSetting)
def admin_update_thresholds(
    payload: UpdateThresholdRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.suspicious_cutoff > payload.fraud_cutoff:
        raise HTTPException(status_code=400, detail="Suspicious cutoff must be <= fraud cutoff")
    thresholds = {"fraud_cutoff": payload.fraud_cutoff, "suspicious_cutoff": payload.suspicious_cutoff}
    _set_setting(db, "thresholds", thresholds)
    _log_audit(
        db,
        actor=current_user,
        action="UPDATE_THRESHOLDS",
        target_type="settings",
        target_id="thresholds",
        details=thresholds,
    )
    return ThresholdSetting(**thresholds)


@app.post("/admin/settings/velocity", response_model=VelocitySetting)
def admin_update_velocity(
    payload: UpdateVelocityRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    data = {"max_transactions": payload.max_transactions, "window_minutes": payload.window_minutes}
    _set_setting(db, "velocity", data)
    _log_audit(
        db,
        actor=current_user,
        action="UPDATE_VELOCITY",
        target_type="settings",
        target_id="velocity",
        details=data,
    )
    return VelocitySetting(**data)


@app.post("/admin/settings/blacklist", response_model=list[BlacklistEntry])
def admin_add_blacklist(
    payload: BlacklistRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items = _get_setting(db, "blacklist", [])
    items.append({"value": payload.value, "type": payload.type})
    _set_setting(db, "blacklist", items)
    _log_audit(
        db,
        actor=current_user,
        action="ADD_BLACKLIST",
        target_type="blacklist",
        target_id=payload.value,
        details={"type": payload.type},
    )
    return [BlacklistEntry(value=item["value"], type=item.get("type", "account_id")) for item in items]


@app.delete("/admin/settings/blacklist", response_model=list[BlacklistEntry])
def admin_remove_blacklist(
    value: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items = _get_setting(db, "blacklist", [])
    items = [item for item in items if item.get("value") != value]
    _set_setting(db, "blacklist", items)
    _log_audit(
        db,
        actor=current_user,
        action="REMOVE_BLACKLIST",
        target_type="blacklist",
        target_id=value,
        details={},
    )
    return [BlacklistEntry(value=item["value"], type=item.get("type", "account_id")) for item in items]


@app.get("/admin/audit-log", response_model=list[ActivityLogItem])
def admin_audit_log(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    del current_user
    return _audit_items(db, limit=100)
