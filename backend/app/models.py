from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    upi_pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user")
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    blocked_reason: Mapped[str] = mapped_column(Text, default="")
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    blocked_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    accounts: Mapped[list[Account]] = relationship("Account", back_populates="owner")
    transactions: Mapped[list[Transaction]] = relationship("Transaction", back_populates="user")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    owner_name: Mapped[str] = mapped_column(String(120))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    home_location: Mapped[str] = mapped_column(String(120), default="Delhi")
    known_devices: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped[User | None] = relationship("User", back_populates="accounts")
    outgoing_transactions: Mapped[list[Transaction]] = relationship(
        "Transaction",
        back_populates="sender_account",
        foreign_keys="Transaction.sender_account_id",
    )
    incoming_transactions: Mapped[list[Transaction]] = relationship(
        "Transaction",
        back_populates="receiver_account",
        foreign_keys="Transaction.receiver_account_id",
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    transaction_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    sender_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    receiver_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    cashback_amount: Mapped[float] = mapped_column(Float, default=0.0)
    transaction_type: Mapped[str] = mapped_column(String(30))
    location: Mapped[str] = mapped_column(String(120))
    device_type: Mapped[str] = mapped_column(String(30))
    is_night: Mapped[bool] = mapped_column(Boolean, default=False)
    is_new_location: Mapped[bool] = mapped_column(Boolean, default=False)
    is_new_device: Mapped[bool] = mapped_column(Boolean, default=False)
    rapid_sequence_count: Mapped[int] = mapped_column(Integer, default=0)
    risk_rule_score: Mapped[float] = mapped_column(Float, default=0.0)
    random_forest_probability: Mapped[float] = mapped_column(Float)
    xgboost_probability: Mapped[float] = mapped_column(Float)
    isolation_forest_score: Mapped[float] = mapped_column(Float)
    final_score: Mapped[float] = mapped_column(Float)
    prediction: Mapped[str] = mapped_column(String(20), index=True)
    shap_importance: Mapped[dict] = mapped_column(JSON)
    feature_payload: Mapped[dict] = mapped_column(JSON)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped[User] = relationship("User", back_populates="transactions")
    sender_account: Mapped[Account] = relationship(
        "Account",
        back_populates="outgoing_transactions",
        foreign_keys=[sender_account_id],
    )
    receiver_account: Mapped[Account] = relationship(
        "Account",
        back_populates="incoming_transactions",
        foreign_keys=[receiver_account_id],
    )


class FraudCase(Base):
    __tablename__ = "fraud_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    case_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="NEW", index=True)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM", index=True)
    reason_flags: Mapped[dict] = mapped_column(JSON)
    analyst_notes: Mapped[str] = mapped_column(Text, default="")
    admin_notes: Mapped[str] = mapped_column(Text, default="")
    escalated_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        index=True,
    )


class SupportQuery(Base):
    __tablename__ = "support_queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    query_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    fraud_case_id: Mapped[int | None] = mapped_column(ForeignKey("fraud_cases.id"), nullable=True)
    query_type: Mapped[str] = mapped_column(String(30), default="USER_TO_TEAM", index=True)
    asked_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str] = mapped_column(Text)
    user_response: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="OPEN", index=True)
    analyst_notes: Mapped[str] = mapped_column(Text, default="")
    admin_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        index=True,
    )
