# backend/app/models/continuity_check.py
"""
ContinuityCheck model - Tracks periodic verifications
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class ContinuityCheck(Base):
    __tablename__ = "continuity_checks"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    
    # Check data
    check_time = Column(DateTime(timezone=True), nullable=False)
    environment_overlap = Column(Float, nullable=True)  # Percentage overlap (0-1)
    hash_link_valid = Column(Boolean, default=False)
    
    # Status
    status = Column(String, default="success")  # success | anomaly | failed
    
    # ZKP data (stored for audit)
    proof_hash = Column(String, nullable=True)  # Hash of the ZKP
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<ContinuityCheck(id={self.id}, session_id={self.session_id}, status='{self.status}')>"