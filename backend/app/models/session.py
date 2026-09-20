# backend/app/models/session.py
"""
Session model - Stores active attendance sessions
Includes Phase 2B: Hash Chain fields (Counter-based)
Includes Wi-Fi Fingerprinting fields
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
    # ✅ NEW: Wi-Fi Fingerprinting fields
    # ========================================
    last_wifi_score = Column(Float, nullable=True)              # Last JSR score [0,1]
    last_wifi_check = Column(DateTime(timezone=True), nullable=True)
    wifi_fail_count = Column(Integer, default=0)                # Consecutive failures
    wifi_verified_count = Column(Integer, default=0)            # Total successes
    has_wifi_template = Column(Boolean, default=False)          # Was template captured?
    
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
    
    # ✅ NEW: Wi-Fi relationships
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