# backend/app/schemas/admin.py
"""
Admin schemas - Phase 2E
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DashboardStats(BaseModel):
    """Dashboard statistics"""
    total_companies: int
    total_students: int
    active_sessions: int
    completed_sessions: int
    attendance_rate: float
    unresolved_anomalies: int


class CompanySummary(BaseModel):
    """Company summary for admin"""
    id: int
    name: str
    student_count: int
    active_sessions: int
    geofence_radius: float
    is_active: bool
    created_at: datetime


class CompanyListResponse(BaseModel):
    """List of companies"""
    companies: List[CompanySummary]
    total: int
    page: int
    limit: int


class StudentSummary(BaseModel):
    """Student summary for admin"""
    id: int
    student_id: str
    name: str
    email: str
    company_name: Optional[str] = None
    has_active_session: bool
    created_at: datetime


class StudentListResponse(BaseModel):
    """List of students"""
    students: List[StudentSummary]
    total: int
    page: int
    limit: int


class SessionSummary(BaseModel):
    """Session summary for admin"""
    id: int
    session_id: str
    student_name: Optional[str] = None
    student_id: Optional[str] = None
    company_name: Optional[str] = None
    entry_time: datetime
    exit_time: Optional[datetime] = None
    duration_minutes: int
    status: str
    has_anomaly: bool
    created_at: datetime


class SessionListResponse(BaseModel):
    """List of sessions"""
    sessions: List[SessionSummary]
    total: int
    page: int
    limit: int


class AnomalySummary(BaseModel):
    """Anomaly summary for admin"""
    id: int
    type: str
    severity: str
    description: Optional[str] = None
    student_name: Optional[str] = None
    company_name: Optional[str] = None
    resolved: bool
    created_at: datetime