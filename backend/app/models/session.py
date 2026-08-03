# backend/app/models/session.py
"""
Session model - Stores active attendance sessions
Includes Phase 2B: Hash Chain fields (Counter-based)
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
    hash_chain_seed = Column(String, nullable=True)      # Random seed for hash chain
    hash_counter = Column(Integer, default=0)            # Current counter value
    hash_chain_length = Column(Integer, default=100)     # Max checks (optional)
    last_hash_check = Column(DateTime(timezone=True), nullable=True)  # Last continuity check
    
    # ========================================
    # Phase 2C: Environment commitment (future)
    # ========================================
    environment_commitment = Column(String, nullable=True)
    
    # ========================================
    # Session status
    # ========================================
    status = Column(String, default="active")  # active | completed | completed_with_anomaly | flagged
    
    # Duration
    total_duration_seconds = Column(Float, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    student = relationship("Student", back_populates="sessions")
    company = relationship("Company", back_populates="sessions")

    def __repr__(self):
        return f"<Session(id={self.id}, session_id='{self.session_id}', status='{self.status}')>"