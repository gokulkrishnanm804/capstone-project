from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .auth import create_access_token, get_current_user, get_password_hash, verify_password
from .ml import get_model_service
from .schemas import (
    AnalyticsResponse,
    LoginRequest,
    PredictionResponse,
    RegisterRequest,
    TokenResponse,
    TransactionFeatures,
    TransactionRecordResponse,
)
from .storage import TransactionRecord, TransactionStore, User, user_store, transaction_store

app = FastAPI(
    title="Explainable AI Driven Secure Multi Model System for Financial Fraud Detection",
    version="1.0.0",
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


@app.get("/features")
def list_features():
    """Return the ordered list of feature column names the model expects."""
    svc = _get_model_service()
    return {"features": svc.feature_order}


@app.post("/register", status_code=201)
def register_user(payload: RegisterRequest):
    if user_store.get_user(payload.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
    hashed_password = get_password_hash(payload.password)
    user = User(username=payload.username, hashed_password=hashed_password, role=payload.role)
    user_store.add_user(user)
    return {"message": "User registered successfully"}


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = user_store.get_user(payload.username)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user.username, "role": user.role}, timedelta(minutes=60))
    return TokenResponse(access_token=token)


@app.post("/predict", response_model=PredictionResponse)
def predict(
    payload: TransactionFeatures,
    current_user: User = Depends(get_current_user),
):
    svc = _get_model_service()
    result = svc.predict(payload)
    importance = result["feature_importance"]
    response = PredictionResponse(
        final_score=result["final_score"],
        prediction=result["prediction"],
        random_forest_probability=result["random_forest_probability"],
        xgboost_probability=result["xgboost_probability"],
        isolation_forest_score=result["isolation_forest_score"],
        feature_importance=importance,
    )
    payload_map = {feature: payload.features.get(feature, 0.0) for feature in svc.feature_order}
    record = TransactionRecord(
        transaction_id=result["transaction_id"],
        username=current_user.username,
        payload=payload_map,
        fraud_probability=result["random_forest_probability"],
        xgb_probability=result["xgboost_probability"],
        isolation_score=result["isolation_forest_score"],
        final_score=result["final_score"],
        prediction=result["prediction"],
        shap_importance={item.feature: item.contribution for item in importance},
        timestamp=datetime.utcnow().isoformat(),
    )
    transaction_store.add_record(record)
    return response


@app.get("/transactions", response_model=List[TransactionRecordResponse])
def list_transactions(current_user: User = Depends(get_current_user)):
    records = transaction_store.recent()
    return [
        TransactionRecordResponse(
            transaction_id=record.transaction_id,
            username=record.username,
            fraud_probability=record.fraud_probability,
            xgb_probability=record.xgb_probability,
            isolation_score=record.isolation_score,
            final_score=record.final_score,
            prediction=record.prediction,
            timestamp=datetime.fromisoformat(record.timestamp),
        )
        for record in records
    ]


@app.get("/fraud-analytics", response_model=AnalyticsResponse)
def fraud_analytics(current_user: User = Depends(get_current_user)):
    metrics = transaction_store.metrics()
    chart_data = [
        {
            "label": record.timestamp.split("T")[0],
            "fraud": 1 if record.prediction == "FRAUD" else 0,
            "normal": 1 if record.prediction == "NORMAL" else 0,
        }
        for record in transaction_store.records[-20:]
    ]
    return AnalyticsResponse(
        total_transactions=metrics["total_transactions"],
        fraud_detected=metrics["fraudulent"],
        fraud_percentage=metrics["fraud_percentage"],
        chart_data=chart_data,
    )
