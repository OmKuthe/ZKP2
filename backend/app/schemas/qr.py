# backend/app/schemas/qr.py
"""
QR schemas for Phase 2A + Phase 2B
"""
from pydantic import BaseModel, Field
from typing import Optional


class QRRequest(BaseModel):
    """Request a QR challenge"""
    student_id: str = Field(..., description="Student ID")
    company_id: int = Field(..., description="Company ID")


class QRResponse(BaseModel):
    """QR challenge response"""
    qr_data: dict = Field(..., description="QR payload with token, timestamps")
    expires_in: int = Field(..., description="Seconds until QR expires")
    message: str = Field(..., description="Status message")


class EntryRequest(BaseModel):
    """Complete entry verification"""
    student_id: str = Field(..., description="Student ID")
    company_id: int = Field(..., description="Company ID")
    qr_token: str = Field(..., description="QR token to verify")
    
    # These will be added in later phases
    qr_proof: Optional[dict] = Field(None, description="ZK proof of QR knowledge")
    gps_proof: Optional[dict] = Field(None, description="GPS geofence proof")
    environment_commitment: Optional[str] = Field(None, description="Hashed environment")


class EntryResponse(BaseModel):
    """Entry response - Phase 2B includes seed"""
    session_id: str = Field(..., description="Unique session ID")
    seed: Optional[str] = Field(None, description="Hash chain seed (for app)")
    message: str = Field(..., description="Status message")
    entry_time: int = Field(..., description="Unix timestamp of entry")


class ExitRequest(BaseModel):
    """Exit verification"""
    session_id: str = Field(..., description="Session ID to close")
    qr_token: str = Field(..., description="Exit QR token")
    hash_link: Optional[str] = Field(None, description="Final hash chain link (Phase 2B)")


class ExitResponse(BaseModel):
    """Exit response"""
    session_id: str
    duration_seconds: int
    status: str
    message: str
    chain_verified: Optional[bool] = Field(None, description="Was the hash chain verified? (Phase 2B)")


class VerifyContinuityRequest(BaseModel):
    """Continuity check request - Phase 2B + 2C"""
    session_id: str
    hash_link: str  # Next hash chain link
    hash_index: int  # Which link in the chain
    environment_proof: Optional[dict] = None
    timestamp: int


class VerifyContinuityResponse(BaseModel):
    """Continuity check response"""
    verified: bool
    next_check_seconds: int
    message: str
    current_index: Optional[int] = None