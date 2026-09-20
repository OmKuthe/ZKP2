# backend/app/models/wifi_template.py
"""
WiFiTemplate model - Stores the Wi-Fi fingerprint template for a session.
Captured at check-in time, used for all subsequent verifications.

Based on: "The Measurable Environment as Nonintrusive Authentication Factor
on the Example of WiFi Beacon Frames" (Jakubeit et al.)
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class WiFiTemplate(Base):
    """
    A Wi-Fi fingerprint template — captured once per session at check-in.
    
    The `template_data` field stores a JSON array of Access Point Representations (APRs):
    [
        {
            "bssid": "AA:BB:CC:DD:EE:01",       # Identifying (but we can hash it)
            "rssi": -45.0,                       # Signal strength in dBm
            "frequency": 2412,                   # MHz (2.4GHz channel 1)
            "capabilities": "WPA2-PSK-CCMP",    # Security/capability features
            "ssid_hash": "abc123..."            # Hashed SSID (privacy-preserving)
        },
        ...
    ]
    
    Only capability features + RSSI are used for similarity scoring (non-PII).
    BSSID can be hashed for storage to further preserve privacy.
    """
    __tablename__ = "wifi_templates"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False, unique=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    # ========================================
    # Template Data (JSON string)
    # ========================================
    template_data = Column(Text, nullable=False)  # JSON list of APRs
    ap_count = Column(Integer, default=0)          # Number of APs in template
    
    # ========================================
    # Threshold (computed from template)
    # ========================================
    # The similarity threshold below which a fingerprint is considered "remote".
    # Computed as the midpoint between local similarity (within template)
    # and a default remote similarity estimate.
    threshold = Column(Float, default=0.7)
    
    # Max allowed RSSI difference between template AP and fingerprint AP
    # for them to be considered "the same AP" (see paper's d(F) parameter).
    rssi_tolerance = Column(Float, default=0.1)  # Normalized [0,1]
    
    # ========================================
    # Status
    # ========================================
    # active | superseded | invalid (e.g., too few APs)
    status = Column(String, default="active")
    is_valid = Column(Boolean, default=True)
    
    # ========================================
    # Metadata
    # ========================================
    captured_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    session = relationship("Session", back_populates="wifi_template")

    def __repr__(self):
        return (
            f"<WiFiTemplate(id={self.id}, session_id={self.session_id}, "
            f"aps={self.ap_count}, valid={self.is_valid})>"
        )