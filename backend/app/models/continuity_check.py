# backend/app/models/continuity_check.py
"""
ContinuityCheck model - Tracks periodic verifications
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class ContinuityCheck(Base):
    __tablename__ = "continuity_checks"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    
    # Check data
    check_time = Column(DateTime(timezone=True), nullable=False)
    check_number = Column(Integer, nullable=False, default=0)  # ✅ NEW: 1, 2, 3, ...
    
    # Hash chain data
    hash_link = Column(String, nullable=True)  # ✅ NEW: The actual hash value
    hash_link_valid = Column(Boolean, default=False)
    
    # Environment data (for Phase 2C)
    environment_overlap = Column(Float, nullable=True)  # Percentage overlap (0-1)
    
    # Status
    status = Column(String, default="pending")  # ✅ CHANGED: pending | verified | failed | anomaly
    
    # Message
    message = Column(Text, nullable=True)  # ✅ NEW: Human-readable status message
    
    # ZKP data (stored for audit)
    proof_hash = Column(String, nullable=True)  # Hash of the ZKP
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("Session", back_populates="continuity_checks")

    def __repr__(self):
        return f"<ContinuityCheck(id={self.id}, session_id={self.session_id}, check_number={self.check_number}, status='{self.status}')>"