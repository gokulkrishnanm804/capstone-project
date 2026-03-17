from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from passlib.context import CryptContext

from .config import settings

DATA_DIR = settings.data_path.parent
DATA_DIR.mkdir(parents=True, exist_ok=True)
USERS_PATH = DATA_DIR / "users.json"
TRANSACTIONS_PATH = DATA_DIR / "transactions.json"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass
class User:
    username: str
    hashed_password: str
    role: str = "user"


@dataclass
class TransactionRecord:
    transaction_id: str
    username: str
    payload: Dict[str, float]
    fraud_probability: float
    xgb_probability: float
    isolation_score: float
    final_score: float
    prediction: str
    shap_importance: Dict[str, float]
    timestamp: str


class UserStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.users: Dict[str, User] = self._load()

    def _load(self) -> Dict[str, User]:
        if not self.path.exists():
            admin_password = pwd_context.hash("Admin@123")
            admin = User(username="admin", hashed_password=admin_password, role="admin")
            self._persist({admin.username: admin})
            return {admin.username: admin}
        raw = json.loads(self.path.read_text())
        return {username: User(**data) for username, data in raw.items()}

    def _persist(self, users: Dict[str, User]) -> None:
        serialised = {username: asdict(user) for username, user in users.items()}
        self.path.write_text(json.dumps(serialised, indent=2))

    def add_user(self, user: User) -> None:
        if user.username in self.users:
            raise ValueError("Username already exists")
        self.users[user.username] = user
        self._persist(self.users)

    def get_user(self, username: str) -> Optional[User]:
        return self.users.get(username)


class TransactionStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.records: List[TransactionRecord] = self._load()

    def _load(self) -> List[TransactionRecord]:
        if not self.path.exists():
            self.path.write_text("[]")
            return []
        raw = json.loads(self.path.read_text())
        return [TransactionRecord(**record) for record in raw]

    def _persist(self) -> None:
        serialised = [asdict(record) for record in self.records]
        self.path.write_text(json.dumps(serialised, indent=2))

    def add_record(self, record: TransactionRecord) -> None:
        self.records.append(record)
        self._persist()

    def recent(self, limit: int = 50) -> List[TransactionRecord]:
        return list(reversed(self.records[-limit:]))

    def metrics(self) -> Dict[str, float]:
        total = len(self.records)
        frauds = sum(1 for record in self.records if record.prediction == "FRAUD")
        fraud_pct = (frauds / total * 100) if total else 0.0
        return {
            "total_transactions": total,
            "fraudulent": frauds,
            "fraud_percentage": round(fraud_pct, 2),
        }


user_store = UserStore(USERS_PATH)
transaction_store = TransactionStore(TRANSACTIONS_PATH)
