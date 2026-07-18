# backend/app/models/anomaly.py
"""
Anomaly model - Tracks suspicious events
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Anomaly details
    type = Column(String, nullable=False)  # environment_mismatch | hash_chain_break | gps_failure | replay_attempt
    severity = Column(String, default="medium")  # low | medium | high
    description = Column(Text, nullable=True)
    
    # Resolution
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("students.id"), nullable=True)  # Admin who resolved
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Anomaly(id={self.id}, type='{self.type}', severity='{self.severity}')>"