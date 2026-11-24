# backend/app/models/session.py
"""
Session model - Stores active attendance sessions.

Includes Phase 2B (hash chain), Wi-Fi fingerprinting, face liveness,
and V2: internship_id, device_id, and per-layer verification rollups.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)

    # Foreign keys
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    # ---- V2 additions ----
    internship_id = Column(Integer, ForeignKey("internships.id"), nullable=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)

    # Timestamps
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=True)

    # QR data
    qr_token = Column(String, nullable=True)
    qr_challenge_id = Column(String, nullable=True)

    # ========================================
    # Phase 2B: Counter-based Hash Chain fields
    # ========================================
    hash_chain_seed = Column(String, nullable=True)
    hash_counter = Column(Integer, default=0)
    hash_chain_length = Column(Integer, default=100)
    last_hash_check = Column(DateTime(timezone=True), nullable=True)
    check_interval_seconds = Column(Integer, default=60)

    # ========================================
    # Phase 2C: Environment commitment
    # ========================================
    environment_commitment = Column(String, nullable=True)
    environment_features = Column(Text, nullable=True)

    # ========================================
    # Wi-Fi Fingerprinting fields
    # ========================================
    last_wifi_score = Column(Float, nullable=True)
    last_wifi_check = Column(DateTime(timezone=True), nullable=True)
    wifi_fail_count = Column(Integer, default=0)
    wifi_verified_count = Column(Integer, default=0)
    has_wifi_template = Column(Boolean, default=False)

    # ========================================
    # Face liveness (login only)
    # ========================================
    face_verified = Column(Boolean, nullable=True)
    face_verified_at = Column(DateTime(timezone=True), nullable=True)

    # ========================================
    # V2: per-layer verification rollups (populated on session close)
    # ========================================
    zkp_verified = Column(Boolean, nullable=True)
    wifi_verified = Column(Boolean, nullable=True)
    chain_verified = Column(Boolean, nullable=True)
    overall_verified = Column(Boolean, nullable=True)

    # ========================================
    # Session status
    # ========================================
    status = Column(String, default="active")

    # Duration
    total_duration_seconds = Column(Float, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    student = relationship("Student", back_populates="sessions")
    company = relationship("Company", back_populates="sessions")
    continuity_checks = relationship("ContinuityCheck", back_populates="session")

    wifi_template = relationship(
        "WiFiTemplate",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )
    wifi_verifications = relationship(
        "WiFiVerification",
        back_populates="session",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Session(id={self.id}, session_id='{self.session_id}', status='{self.status}')>"