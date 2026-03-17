from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_user, get_password_hash, require_admin, verify_password
from .db import Base, engine, get_db
from .ml import get_model_service
from .models import Account, Transaction, User
from .schemas import (
    AccountResponse,
    AnalyticsPoint,
    AnalyticsResponse,
    LoginRequest,
    ModelInsightResponse,
    PredictionBreakdown,
    RegisterRequest,
    RiskDistributionPoint,
    RiskSignals,
    SimulationContextResponse,
    SimulationTransactionRequest,
    TokenResponse,
    TransactionExecutionResponse,
    TransactionHistoryItem,
    TransactionVolumePoint,
    UserProfile,
)

app = FastAPI(
    title="FraudGuard AI - Simulation-Based Explainable Multi-Model Fraud Detection System",
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
    db.commit()


@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(bind=engine) as db:
        _ensure_seed_data(db)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/register", status_code=201)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if payload.role not in {"user", "admin"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    user = User(
        full_name=payload.name.strip(),
        email=email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
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
        user=UserProfile(id=user.id, name=user.full_name, email=user.email, role=user.role),
    )


@app.get("/me", response_model=UserProfile)
def current_profile(current_user: User = Depends(get_current_user)):
    return UserProfile(
        id=current_user.id,
        name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
    )


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

    receivers = (
        db.query(Account)
        .filter(Account.account_number != sender.account_number)
        .order_by(Account.created_at.asc())
        .limit(12)
        .all()
    )

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
    is_night = now.hour >= 22 or now.hour <= 5

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

    if execute_transfer and payload.amount > sender_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    now = datetime.utcnow()
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
    adjusted_final = max(0.0, min(adjusted_final, 1.0))

    prediction = "FRAUD" if adjusted_final >= 0.5 else "SAFE"
    risk_band = _risk_band(adjusted_final)

    note = "Transaction executed"
    if execute_transfer:
        sender.balance = sender_balance - payload.amount
        receiver.balance = receiver_balance + payload.amount
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if fraud_only:
        query = query.filter(Transaction.prediction == "FRAUD")
    if start_date:
        query = query.filter(Transaction.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.filter(Transaction.created_at <= datetime.combine(end_date, time.max))

    records = query.order_by(Transaction.created_at.desc()).limit(300).all()
    return [
        TransactionHistoryItem(
            transaction_id=row.transaction_id,
            date=row.created_at,
            amount=row.amount,
            receiver=row.receiver_account.owner_name,
            transaction_type=row.transaction_type,
            location=row.location,
            device_type=row.device_type,
            prediction=row.prediction,
            risk_score=row.final_score,
        )
        for row in records
    ]


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
