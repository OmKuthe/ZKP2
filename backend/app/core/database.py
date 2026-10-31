"""
Database configuration.
Uses SQLite for development, PostgreSQL for production.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging

from .config import settings

logger = logging.getLogger(__name__)

# Use SQLite for development
# Switch to PostgreSQL by changing DATABASE_URL
DATABASE_URL = settings.DATABASE_URL

# SQLite specific settings
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}  # Needed for SQLite
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _ensure_unique_active_session_index():
    """
    Flaw #4: enforce at most one active session per student at the DB level.

    The application-level check in start_entry/complete_entry/request_qr is
    racy under concurrent requests (double-tap, retry-on-timeout, etc.). This
    partial unique index makes the DB the source of truth.

    Uses IF NOT EXISTS so it is idempotent across restarts and works on both
    SQLite and PostgreSQL.
    """
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "one_active_session_per_student "
                "ON sessions (student_id) "
                "WHERE status = 'active'"
            ))
            conn.commit()
            logger.info("✅ Unique index 'one_active_session_per_student' ensured")
        except Exception as e:
            # Non-fatal: if this fails, app-level checks still work (just racy).
            # Surface the error in logs so it's visible, but don't crash startup.
            logger.error(
                f"⚠️ Could not create 'one_active_session_per_student' index: {e}"
            )


# NOTE: called from main.py AFTER Base.metadata.create_all(bind=engine),
# because the sessions table must exist before we can index it.


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()