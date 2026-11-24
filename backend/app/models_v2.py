# backend/app/models_v2.py
"""
ZKAttend V2 — SQLAlchemy 2.0 models.

Import via models/__init__.py. Never imported by V1 routes directly —
V1 routes continue to import from their existing model files. This module
is additive: it defines NEW tables (users, devices, zkp_verifications,
face_verifications, verification_events, presence_challenges, audit_log)
and NEW columns on existing tables (companies.timezone, sessions.internship_id
etc.) via a separate class definition strategy: we *extend* the existing
SQLAlchemy classes rather than redefine them, so `models.X` and `models_v2.X`
are the same class where appropriate.

Strategy:
  - For NEW tables: define classes here, import them in models/__init__.py.
  - For ALTERed existing tables: do NOT redefine the class. Instead, provide
    a `V2_COLUMN_EXTENSIONS` dict that the migration script uses to ALTER
    the table. The existing V1 model class stays the source of truth for
    those tables; V2 routes can query them by name via existing imports.

This means models_v2.py is the single source of truth for V2-only tables,
while V1 models + migration ALTERs are the source of truth for existing
tables. No dual definitions, no duplicate class objects.
"""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .core.database import Base


# =========================================================================
# Enums — stored as VARCHAR in SQLite, validated at the application layer
# =========================================================================

class UserRole(str, enum.Enum):
    student = "student"
    admin = "admin"


class SessionStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    flagged = "flagged"
    abandoned = "abandoned"


class AnomalyStatus(str, enum.Enum):
    open = "open"
    reviewed = "reviewed"
    dismissed = "dismissed"
    resolved = "resolved"


class AnomalySeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class VerificationLayer(str, enum.Enum):
    zkp = "zkp"
    face = "face"
    wifi = "wifi"
    chain = "chain"


class VerificationEventType(str, enum.Enum):
    attempt = "attempt"
    success = "success"
    failure = "failure"
    challenge_sent = "challenge_sent"
    challenge_passed = "challenge_passed"
    challenge_failed = "challenge_failed"


class ChallengeStatus(str, enum.Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"
    expired = "expired"


# =========================================================================
# NEW: users — unified auth identity (admin + student)
# =========================================================================

class User(Base):
    """Single auth table. Replaces hardcoded admin + students.password_hash
    as the long-term identity. Migration inserts 1 admin + 1 per student."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False, length=16), nullable=False
    )
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationship to the student profile (nullable — admins have none)
    student_profile: Mapped[Optional["StudentProfile"]] = relationship(
        back_populates="user", uselist=False
    )


class StudentProfile(Base):
    """1:1 profile row that binds a User with role='student' to the existing
    `students` table (V1). V2 does not modify the `students` table itself;
    this side table points at it.

    `student_v1_id` refers to students.id (the V1 PK).
    """
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=False
    )
    student_v1_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"), unique=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="student_profile")


# =========================================================================
# NEW: devices — one row per push-registered device
# =========================================================================

class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)

    push_token: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)  # 'android' | 'ios'
    device_fingerprint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_devices_student_active", "student_id", "deleted_at"),
    )


# =========================================================================
# NEW: zkp_verifications — one row per ZKP generation/verification call
# =========================================================================

class ZkpVerification(Base):
    """Typed record for the ZKP layer. In V1, ZKP results were only in the
    HTTP response — never persisted. V2 persists them for audit + analytics."""
    __tablename__ = "zkp_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False, index=True)

    purpose: Mapped[str] = mapped_column(String(16), nullable=False)  # 'entry' | 'exit'
    valid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Diagnostics (nullable — populated only when generation succeeds)
    public_signals: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    actual_distance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    radius: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# =========================================================================
# NEW: face_verifications — one row per liveness check
# =========================================================================

class FaceVerification(Base):
    """Typed record for the face liveness layer. V1 stored only a boolean on
    sessions.face_verified. V2 keeps the boolean as a rollup AND records
    each verification event here."""
    __tablename__ = "face_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False, index=True)

    event_type: Mapped[str] = mapped_column(String(32), nullable=False)  # 'entry_liveness' | 'reverify'
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# =========================================================================
# NEW: verification_events — thin index across the 4 typed tables
# =========================================================================

class VerificationEvent(Base):
    """One row per layer event. `source_table`/`source_id` point to the
    typed row (heartbeats, wifi_verifications, zkp_verifications,
    face_verifications). Query here for cheap histograms; join to the
    typed table for detail.

    This table is written by V2 write paths *in addition to* the typed
    tables. It is NOT the source of truth for detail — it is the
    normalized timeline."""
    __tablename__ = "verification_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False, index=True)

    layer: Mapped[VerificationLayer] = mapped_column(
        SAEnum(VerificationLayer, native_enum=False, length=16), nullable=False
    )
    event_type: Mapped[VerificationEventType] = mapped_column(
        SAEnum(VerificationEventType, native_enum=False, length=32), nullable=False
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    source_table: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_verif_events_session_layer_time", "session_id", "layer", "occurred_at"),
        Index("ix_verif_events_source", "source_table", "source_id"),
    )


# =========================================================================
# NEW: presence_challenges — re-verify challenge/response
# =========================================================================

class PresenceChallenge(Base):
    __tablename__ = "presence_challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False, index=True)
    device_id: Mapped[Optional[int]] = mapped_column(ForeignKey("devices.id"), nullable=True)

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[ChallengeStatus] = mapped_column(
        SAEnum(ChallengeStatus, native_enum=False, length=16), nullable=False, default=ChallengeStatus.pending
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_challenges_session_status", "session_id", "status"),
        Index("ix_challenges_status_expires", "status", "expires_at"),
    )


# =========================================================================
# NEW: audit_log — who did what, when
# =========================================================================

class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_audit_entity", "entity_type", "entity_id"),
        Index("ix_audit_actor_time", "actor_user_id", "created_at"),
    )


# =========================================================================
# NEW: schema_migrations — idempotency guard for the migration
# =========================================================================

class SchemaMigration(Base):
    __tablename__ = "schema_migrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# =========================================================================
# V2_COLUMN_EXTENSIONS — declarative list of ALTERs for existing tables
# =========================================================================
# The migration script reads this dict and issues ALTER TABLE ... ADD COLUMN
# for each entry that isn't already present. This is the ONLY place V2
# schema is declared for existing tables, so keep it in sync with the
# models above.
#
# Format: {table: [(column_name, sql_type, default_clause_or_None, nullable)]}

V2_COLUMN_EXTENSIONS = {
    "companies": [
        ("timezone", "VARCHAR(64)", "'Asia/Kolkata'", False),
    ],
    "sessions": [
        ("internship_id", "INTEGER", None, True),   # FK added separately (SQLite ALTER lacks FK)
        ("device_id", "INTEGER", None, True),
        ("zkp_verified", "BOOLEAN", None, True),
        ("wifi_verified", "BOOLEAN", None, True),
        ("chain_verified", "BOOLEAN", None, True),
        ("overall_verified", "BOOLEAN", None, True),
    ],
    "anomalies": [
        ("status", "VARCHAR(16)", "'open'", False),
        ("reviewed_by", "INTEGER", None, True),
        ("reviewed_at", "DATETIME", None, True),
        ("review_note", "TEXT", None, True),
    ],
}