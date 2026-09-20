# backend/app/schemas/wifi.py
"""
Wi-Fi fingerprinting schemas.
Defines the request/response shapes for enrollment and verification.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ============================================================
# Core Building Block: Access Point Representation (APR)
# ============================================================

class AccessPointRepresentation(BaseModel):
    """
    A single Wi-Fi Access Point as seen by the mobile device.
    
    We use only non-PII features (no raw SSID, no raw MAC).
    BSSID is the hardware address — we treat it as an opaque ID,
    but it's ok to send it over TLS since it's ephemeral for matching.
    """
    bssid: str = Field(..., description="MAC address of the AP (unique ID)")
    rssi: float = Field(..., description="Signal strength in dBm (e.g., -45.0)")
    frequency: Optional[int] = Field(None, description="Channel frequency in MHz")
    capabilities: Optional[str] = Field(
        None, description="Capability/security string (e.g., 'WPA2-PSK-CCMP')"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "bssid": "AA:BB:CC:DD:EE:01",
                "rssi": -45.0,
                "frequency": 2412,
                "capabilities": "WPA2-PSK-CCMP"
            }
        }


# ============================================================
# Enroll Endpoint
# ============================================================

class WiFiEnrollRequest(BaseModel):
    """
    Request to enroll a Wi-Fi template for a session.
    Called by the mobile app immediately after successful check-in.
    """
    session_id: str = Field(..., description="Active session ID")
    scans: List[List[AccessPointRepresentation]] = Field(
        ...,
        description=(
            "Multiple scans captured over time. Each scan is a list of APs. "
            "The server aggregates these into a single template."
        )
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session_abc123",
                "scans": [
                    [
                        {"bssid": "AA:BB:CC:DD:EE:01", "rssi": -45.0, "frequency": 2412, "capabilities": "WPA2"},
                        {"bssid": "AA:BB:CC:DD:EE:02", "rssi": -60.0, "frequency": 5180, "capabilities": "WPA3"}
                    ],
                    [
                        {"bssid": "AA:BB:CC:DD:EE:01", "rssi": -47.0, "frequency": 2412, "capabilities": "WPA2"},
                        {"bssid": "AA:BB:CC:DD:EE:02", "rssi": -58.0, "frequency": 5180, "capabilities": "WPA3"}
                    ]
                ]
            }
        }


class WiFiEnrollResponse(BaseModel):
    """Response from the enroll endpoint."""
    success: bool
    message: str
    template_id: Optional[int] = None
    ap_count: int = 0
    threshold: Optional[float] = None
    is_valid: bool = True


# ============================================================
# Verify Endpoint
# ============================================================

class WiFiVerifyRequest(BaseModel):
    """
    Request to verify the current Wi-Fi environment against the enrolled template.
    """
    session_id: str = Field(..., description="Active session ID")
    scan: List[AccessPointRepresentation] = Field(
        ..., description="Current scan of nearby APs"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session_abc123",
                "scan": [
                    {"bssid": "AA:BB:CC:DD:EE:01", "rssi": -46.0, "frequency": 2412, "capabilities": "WPA2"},
                    {"bssid": "AA:BB:CC:DD:EE:02", "rssi": -75.0, "frequency": 5180, "capabilities": "WPA3"}
                ]
            }
        }


class WiFiVerifyResponse(BaseModel):
    """Response from the verify endpoint."""
    verified: bool
    similarity_score: float
    threshold: float
    is_anomaly: bool
    ap_count_current: int
    ap_count_template: int
    common_aps: int
    total_aps: int
    message: str
    anomaly_id: Optional[int] = None  # Set if an anomaly was created


# ============================================================
# Template Info (for admin)
# ============================================================

class WiFiTemplateInfo(BaseModel):
    """Read-only view of a template, for admin debugging."""
    id: int
    session_id: int
    company_id: int
    student_id: int
    ap_count: int
    threshold: float
    rssi_tolerance: float
    is_valid: bool
    status: str
    captured_at: datetime

    class Config:
        from_attributes = True


class WiFiVerificationInfo(BaseModel):
    """Read-only view of a verification log entry."""
    id: int
    session_id: int
    jsr_score: float
    threshold: float
    is_match: bool
    is_anomaly: bool
    common_aps: int
    total_aps: int
    checked_at: datetime
    anomaly_reason: Optional[str] = None

    class Config:
        from_attributes = True