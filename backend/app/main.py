from __future__ import annotations

import random
import statistics
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, or_, text
from sqlalchemy.orm import Session, joinedload

from .auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    require_admin,
    require_analyst_or_admin,
    verify_password,
)
from .db import Base, engine, get_db
from .ml import get_model_service
from .models import Account, FraudCase, SupportQuery, Transaction, User
from .schemas import (
    AccountResponse,
    AnalystTransactionItem,
    AnalystUserQueryRequest,
    AnalyticsPoint,
    AnalyticsResponse,
    BlockedQueryRequest,
    FraudCaseAdminActionRequest,
    FraudCaseResponse,
    FraudCaseReviewRequest,
    FeatureImportance,
    LoginRequest,
    ModelInsightResponse,
    PredictionBreakdown,
    RegisterRequest,
    RewardItem,
    RewardsSummaryResponse,
    RiskDistributionPoint,
    RiskSignals,
    SetUpiPinRequest,
    SupportQueryResponse,
    SupportQueryUpdateRequest,
    SimulationContextResponse,
    SimulationTransactionRequest,
    TokenResponse,
    TransactionExecutionResponse,
    TransactionHistoryItem,
    TransactionVolumePoint,
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


def _get_model_service():
    global model_service
    if model_service is None:
        model_service = get_model_service()
    return model_service


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
    if score < 0.35:
        return "LOW"
    if score < 0.65:
        return "MEDIUM"
    return "HIGH"


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

    normalized = transaction_time.strip().upper()
    try:
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
VALID_QUERY_TYPES = {"USER_TO_TEAM", "ANALYST_TO_USER"}


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

    analyst = db.query(User).filter(User.email == "analyst@fraudguard.ai").first()
    if analyst is None:
        analyst = User(
            full_name="Fraud Analyst",
            email="analyst@fraudguard.ai",
            hashed_password=get_password_hash("Analyst@123"),
            role="analyst",
        )
        db.add(analyst)
        db.flush()
        db.add(
            Account(
                account_number=_new_account_number(),
                owner_name=analyst.full_name,
                user_id=analyst.id,
                balance=100000.00,
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
    db.commit()


def _ensure_schema_migrations() -> None:
    inspector = inspect(engine)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
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

    user = User(
        full_name=payload.name.strip(),
        email=email,
        hashed_password=get_password_hash(payload.password),
        upi_pin_hash=get_password_hash(payload.upi_pin),
        role="user",
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
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCOUNT_BLOCKED",
                "msg": "Account is blocked. Contact admin.",
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
    return TokenResponse(
        access_token=token,
        user=UserProfile(
            id=user.id,
            name=user.full_name,
            email=user.email,
            role=user.role,
            has_upi_pin=bool(user.upi_pin_hash),
            is_blocked=user.is_blocked,
        ),
    )


@app.get("/me", response_model=UserProfile)
def current_profile(current_user: User = Depends(get_current_user)):
    return UserProfile(
        id=current_user.id,
        name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        has_upi_pin=bool(current_user.upi_pin_hash),
        is_blocked=current_user.is_blocked,
    )


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
    return {"message": "Your query has been submitted to analyst and admin teams."}


@app.get("/simulation/context", response_model=SimulationContextResponse)
def simulation_context(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
    known_locations = sorted({tx.location for tx in user_transactions} | {sender.home_location})
    known_devices = sorted(set(sender.known_devices or ["Mobile"]))

    return SimulationContextResponse(
        sender_account=_to_account_response(sender),
        receivers=[_to_account_response(account) for account in receivers],
        known_locations=known_locations,
        known_devices=known_devices,
    )


def _build_risk_signals(
    *,
    db: Session,
    current_user: User,
    sender: Account,
    amount: float,
    location: str,
    device_type: str,
    mode: str,
    now: datetime,
) -> dict:
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

    # Always include profile baselines so first suspicious simulation can still
    # trigger new-location/new-device signals.
    previous_locations.add(sender.home_location)
    previous_devices.update(set(sender.known_devices or ["Mobile"]))

    is_new_location = location not in previous_locations
    is_new_device = device_type not in previous_devices

    # Evaluate night behavior in UPI-local timezone rather than server UTC.
    local_now = (
        now.astimezone(ZoneInfo("Asia/Kolkata"))
        if now.tzinfo
        else now.replace(tzinfo=timezone.utc).astimezone(ZoneInfo("Asia/Kolkata"))
    )
    is_night = local_now.hour >= 22 or local_now.hour <= 5

    current_balance = max(_decimal_to_float(sender.balance), 1.0)
    amount_signal = min(amount / current_balance, 1.0)
    if amount >= 50000:
        amount_signal = max(amount_signal, 0.82)

    rapid_transfer_signal = min(rapid_sequence_count / 4, 1.0)
    location_signal = 1.0 if is_new_location else 0.08
    device_signal = 1.0 if is_new_device else 0.08
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
        if is_new_location and is_new_device:
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
    }


@app.post("/simulation/transaction", response_model=TransactionExecutionResponse)
def simulate_transaction(
    payload: SimulationTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mode = payload.mode.lower()
    if mode not in {"send", "simulate"}:
        raise HTTPException(status_code=400, detail="mode must be send or simulate")

    sender_query = db.query(Account).filter(Account.user_id == current_user.id)
    if payload.sender_account:
        sender_query = sender_query.filter(Account.account_number == payload.sender_account)
    sender = sender_query.order_by(Account.created_at.asc()).first()
    if sender is None:
        raise HTTPException(status_code=404, detail="Sender account not found")

    receiver = db.query(Account).filter(Account.account_number == payload.receiver_account).first()
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
            raise HTTPException(status_code=401, detail="Invalid UPI PIN")

    if execute_transfer and payload.amount > sender_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    now = _resolve_transaction_datetime(payload.transaction_time)
    risk_signals = _build_risk_signals(
        db=db,
        current_user=current_user,
        sender=sender,
        amount=payload.amount,
        location=payload.location,
        device_type=payload.device_type,
        mode=mode,
        now=now,
    )
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
        transaction_type=payload.transaction_type,
        sender_balance=sender_balance,
        receiver_balance=receiver_balance,
        risk_signals=risk_signals,
        timestamp=now,
        location=payload.location,
        device_type=payload.device_type,
    )
    model_result = service.predict_from_features(mapped_features)

    adjusted_final = model_result["fusion_score"] * 0.7 + risk_signals["rule_score"] * 0.3
    if mode == "simulate":
        # In simulate mode, rule-driven anomalies should have stronger effect
        # than model priors so users can clearly observe fraud scenarios.
        adjusted_final = max(
            adjusted_final,
            model_result["fusion_score"] * 0.45 + risk_signals["rule_score"] * 0.55,
        )
        if risk_signals["rule_score"] >= 0.75:
            adjusted_final = max(adjusted_final, 0.72)
        elif risk_signals["rule_score"] >= 0.62:
            adjusted_final = max(adjusted_final, 0.58)

    if execute_transfer:
        supervised_score = (
            model_result["random_forest_probability"]
            + model_result["xgboost_probability"]
        ) / 2
        unsupervised_score = model_result["isolation_forest_score"]

        hybrid_score = (
            0.45 * supervised_score
            + 0.25 * unsupervised_score
            + 0.30 * risk_signals["rule_score"]
        )
        adjusted_final = max(adjusted_final, hybrid_score)

        # Practical anomaly gate for high-value new-context transfers.
        if (
            risk_signals["amount_signal"] >= 0.7
            and risk_signals["is_new_location"]
            and risk_signals["is_new_device"]
        ):
            adjusted_final = max(adjusted_final, 0.56)

        # Unsupervised anomaly + contextual drift should be treated as high risk.
        if (
            unsupervised_score >= 0.34
            and risk_signals["is_new_location"]
            and risk_signals["amount_signal"] >= 0.55
        ):
            adjusted_final = max(adjusted_final, 0.58)

    if hard_rule_triggered:
        adjusted_final = max(adjusted_final, 0.95)
    adjusted_final = max(0.0, min(adjusted_final, 1.0))

    prediction = "FRAUD" if adjusted_final >= 0.5 else "SAFE"
    risk_band = _risk_band(adjusted_final)

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

        sender.balance = sender_balance - payload.amount
        sender.balance = _decimal_to_float(sender.balance) + cashback_earned
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
        location=payload.location,
        device_type=payload.device_type,
        is_night=risk_signals["is_night"],
        is_new_location=risk_signals["is_new_location"],
        is_new_device=risk_signals["is_new_device"],
        rapid_sequence_count=risk_signals["rapid_sequence_count"],
        risk_rule_score=risk_signals["rule_score"],
        random_forest_probability=model_result["random_forest_probability"],
        xgboost_probability=model_result["xgboost_probability"],
        isolation_forest_score=model_result["isolation_forest_score"],
        final_score=adjusted_final,
        prediction=prediction,
        shap_importance={
            item.feature: item.contribution for item in model_result["feature_importance"]
        },
        feature_payload=model_result["feature_payload"],
        note=note,
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
                "final_score": round(float(adjusted_final), 4),
            },
            analyst_notes="",
            admin_notes="",
        )
        db.add(fraud_case)

    db.commit()
    db.refresh(sender)
    db.refresh(receiver)

    return TransactionExecutionResponse(
        transaction_id=transaction.transaction_id,
        sender_account=_to_account_response(sender),
        receiver_account=_to_account_response(receiver),
        transaction_type=payload.transaction_type,
        amount=payload.amount,
        location=payload.location,
        device_type=payload.device_type,
        executed=execute_transfer,
        note=note,
        cashback_earned=cashback_earned,
        timestamp=transaction.created_at,
        risk_signals=RiskSignals(**risk_signals),
        prediction=PredictionBreakdown(
            fraud_probability=adjusted_final,
            random_forest_probability=model_result["random_forest_probability"],
            xgboost_probability=model_result["xgboost_probability"],
            isolation_forest_score=model_result["isolation_forest_score"],
            final_fusion_score=adjusted_final,
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


@app.get("/analyst/transactions", response_model=list[AnalystTransactionItem])
def analyst_transactions(
    limit: int = Query(120, ge=1, le=500),
    prediction: str | None = Query(None),
    transaction_id: str | None = Query(None),
    include_explanations: bool = Query(False),
    current_user: User = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    prediction_filter = prediction.strip().upper() if prediction else None
    if prediction_filter not in {None, "FRAUD", "SAFE"}:
        raise HTTPException(status_code=400, detail="prediction must be FRAUD or SAFE")

    query = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.sender_account),
            joinedload(Transaction.receiver_account),
            joinedload(Transaction.user),
        )
        .order_by(Transaction.created_at.desc())
    )
    if prediction_filter:
        query = query.filter(Transaction.prediction == prediction_filter)
    if transaction_id:
        query = query.filter(Transaction.transaction_id == transaction_id.strip())

    records = query.limit(limit).all()
    should_include_explanations = include_explanations or bool(transaction_id)
    service = _get_model_service() if should_include_explanations else None
    response_rows: list[AnalystTransactionItem] = []
    for row in records:
        shap_items: list[FeatureImportance] = []
        feature_payload = {}
        if should_include_explanations:
            recomputed_importance: list[FeatureImportance] = []
            try:
                if row.feature_payload and service is not None:
                    recomputed_importance = service.explain_feature_payload(
                        row.feature_payload,
                        top_n=12,
                    )
            except Exception:
                recomputed_importance = []

            if recomputed_importance:
                shap_items = recomputed_importance
            else:
                shap_map = row.shap_importance or {}
                ranked_shap = sorted(
                    (
                        (str(feature), float(contribution))
                        for feature, contribution in shap_map.items()
                    ),
                    key=lambda item: abs(item[1]),
                    reverse=True,
                )
                shap_items = [
                    FeatureImportance(feature=feature, contribution=contribution)
                    for feature, contribution in ranked_shap[:12]
                ]
            feature_payload = row.feature_payload or {}

        response_rows.append(
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
    return response_rows


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
        created_at=query.created_at,
        updated_at=query.updated_at,
    )


@app.get("/fraud-cases", response_model=list[FraudCaseResponse])
def list_fraud_cases(
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_analyst_or_admin),
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
    current_user: User = Depends(require_analyst_or_admin),
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
    current_user: User = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    del current_user
    query = (
        db.query(SupportQuery, User.full_name, User.email, FraudCase.case_id)
        .join(User, User.id == SupportQuery.user_id)
        .outerjoin(FraudCase, FraudCase.id == SupportQuery.fraud_case_id)
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
        )
        for support_query, user_name, user_email, case_id_value in rows
    ]


@app.patch("/support-queries/{query_id}", response_model=SupportQueryResponse)
def update_support_query(
    query_id: str,
    payload: SupportQueryUpdateRequest,
    current_user: User = Depends(require_analyst_or_admin),
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


@app.post("/fraud-cases/{case_id}/user-query", response_model=SupportQueryResponse, status_code=201)
def create_user_query_from_analyst(
    case_id: str,
    payload: AnalystUserQueryRequest,
    current_user: User = Depends(require_analyst_or_admin),
    db: Session = Depends(get_db),
):
    case = db.query(FraudCase).filter(FraudCase.case_id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Fraud case not found")

    support_query = SupportQuery(
        query_id=_new_support_query_id(),
        user_id=case.user_id,
        fraud_case_id=case.id,
        query_type="ANALYST_TO_USER",
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
        db.query(SupportQuery, FraudCase.case_id)
        .outerjoin(FraudCase, FraudCase.id == SupportQuery.fraud_case_id)
        .filter(
            SupportQuery.user_id == current_user.id,
            SupportQuery.query_type == "ANALYST_TO_USER",
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
        )
        for support_query, case_id_value in rows
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
            SupportQuery.query_type == "ANALYST_TO_USER",
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
