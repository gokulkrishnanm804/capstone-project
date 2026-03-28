from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    secret_key: str = "change_me_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    database_url: str = "mysql+pymysql://root:root@localhost:3306/fraudguard_ai"
    model_dir: Path = BASE_DIR / "models"
    data_path: Path = BASE_DIR / "data" / "creditcard.csv"

    @field_validator("model_dir", "data_path", mode="before")
    @classmethod
    def _resolve_paths(cls, value):
        path_value = Path(value)
        if path_value.is_absolute():
            return path_value

        # Support both "models" (relative to backend/) and legacy "backend/models"
        # (relative to repository root) without depending on the current working directory.
        candidate_backend = (BASE_DIR / path_value).resolve()
        candidate_repo = (BASE_DIR.parent / path_value).resolve()
        if candidate_backend.exists() or not candidate_repo.exists():
            return candidate_backend
        return candidate_repo

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        protected_namespaces=("settings_",),
    )


settings = Settings()
