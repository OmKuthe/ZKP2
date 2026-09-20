# backend/app/models/wifi_verification.py
"""
WiFiVerification model - Logs every Wi-Fi fingerprint verification attempt.
Used for auditing, analysis, and detecting anomalies.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class WiFiVerification(Base):
    """
    A single Wi-Fi fingerprint verification attempt.
    
    Stores the JSR score and the raw fingerprint for later analysis.
    Every continuity check that includes Wi-Fi data creates one of these rows.
    """
    __tablename__ = "wifi_verifications"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("wifi_templates.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # ========================================
    # Verification Data
    # ========================================
    fingerprint_data = Column(Text, nullable=False)  # JSON of current scan
    ap_count = Column(Integer, default=0)            # APs seen in current scan
    
    # ========================================
    # Scoring
    # ========================================
    jsr_score = Column(Float, nullable=False)        # Jaccard Similarity with RSSI [0,1]
    threshold = Column(Float, nullable=False)        # Threshold used at this check
    rssi_tolerance = Column(Float, nullable=False)   # d(F) used at this check
    
    # ========================================
    # Decision
    # ========================================
    is_match = Column(Boolean, nullable=False)       # jsr_score >= threshold
    is_anomaly = Column(Boolean, default=False)      # True when is_match=False
    anomaly_reason = Column(String, nullable=True)   # Human-readable explanation
    
    # ========================================
    # Diagnostics
    # ========================================
    common_aps = Column(Integer, default=0)          # Intersection count (APs in both)
    total_aps = Column(Integer, default=0)           # Union count
    
    # ========================================
    # Metadata
    # ========================================
    checked_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("Session", back_populates="wifi_verifications")
    template = relationship("WiFiTemplate")

    def __repr__(self):
        return (
            f"<WiFiVerification(id={self.id}, session={self.session_id}, "
            f"jsr={self.jsr_score:.3f}, match={self.is_match})>"
        )