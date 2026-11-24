# backend/app/models/anomaly.py
"""
Anomaly model - Tracks suspicious events.

V2 adds: status (open|reviewed|dismissed|resolved), reviewed_by/reviewed_at/
review_note for the admin review workflow. The old `resolved` boolean is
preserved for backward compatibility; new code should use `status`.
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
    type = Column(String, nullable=False)
    severity = Column(String, default="medium")
    description = Column(Text, nullable=True)

    # Legacy resolution fields (V1)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("students.id"), nullable=True)

    # ---- V2 additions ----
    status = Column(String, nullable=False, default="open")  # open|reviewed|dismissed|resolved
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Anomaly(id={self.id}, type='{self.type}', severity='{self.severity}', status='{self.status}')>"