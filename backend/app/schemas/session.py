# backend/app/schemas/session.py
"""
Session schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionResponse(BaseModel):
    """Session response"""
    id: int
    session_id: str
    student_id: int
    company_id: int
    entry_time: datetime
    exit_time: Optional[datetime] = None
    status: str  # active | completed | completed_with_anomaly | flagged
    total_duration_seconds: Optional[float] = None

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    """List of sessions"""
    sessions: list[SessionResponse]
    total: int