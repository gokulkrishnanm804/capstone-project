from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .config import settings


def _sqlite_fallback_url() -> str:
    fallback_path = (Path(__file__).resolve().parents[1] / "data" / "local_fallback.db").resolve()
    fallback_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{fallback_path.as_posix()}"


def _build_engine(database_url: str):
    if database_url.startswith("sqlite"):
        return create_engine(database_url, connect_args={"check_same_thread": False})
    return create_engine(database_url, pool_pre_ping=True)


def _initialise_engine():
    primary_engine = _build_engine(settings.database_url)
    try:
        with primary_engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        return primary_engine
    except OperationalError as exc:
        fallback_url = _sqlite_fallback_url()
        print(
            "[WARN] Database connection failed for configured DATABASE_URL. "
            f"Falling back to SQLite at {fallback_url}. Error: {exc}"
        )
        return _build_engine(fallback_url)


engine = _initialise_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
