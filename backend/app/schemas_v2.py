# backend/app/schemas_v2.py
"""Pydantic v2 response models for V2 read endpoints (Phase 2)."""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ---------- Session list item (History screen) ----------

class SessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    internship_id: Optional[int] = None
    company_name: Optional[str] = None
    internship_name: Optional[str] = None

    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: int

    status: str  # active | closed | flagged | abandoned

    zkp_verified: Optional[bool] = None
    face_verified: Optional[bool] = None
    wifi_verified: Optional[bool] = None
    chain_verified: Optional[bool] = None
    overall_verified: Optional[bool] = None

    anomaly_count: int = 0


class SessionListResponse(BaseModel):
    sessions: List[SessionListItem]
    total: int
    page: int
    limit: int


# ---------- Calendar ----------

class CalendarDay(BaseModel):
    day: date
    present: bool
    session_count: int
    verified_count: int
    flagged_count: int


class CalendarResponse(BaseModel):
    student_id: str
    month: str  # "YYYY-MM"
    timezone: str
    days: List[CalendarDay]


# ---------- Session detail (drawer) ----------

class VerificationEventItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    layer: str
    event_type: str
    occurred_at: datetime
    source_table: str
    source_id: int


class HeartbeatItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sequence_num: int
    valid: bool
    client_reported_at: Optional[datetime]
    server_received_at: Optional[datetime]
    backfilled: bool


class AnomalyItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    severity: str
    status: str
    description: Optional[str] = None
    detected_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    review_note: Optional[str] = None


class SessionDetail(BaseModel):
    session: SessionListItem
    events: List[VerificationEventItem]
    heartbeats: List[HeartbeatItem]
    anomalies: List[AnomalyItem]
    challenges: List["ChallengeItem"]


# ---------- Anomalies (Flagged Sessions view) ----------

class AnomalyRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    session_uuid: Optional[str] = None
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    company_name: Optional[str] = None
    type: str
    severity: str
    status: str
    description: Optional[str] = None
    detected_at: datetime
    reviewed_at: Optional[datetime] = None


class AnomalyListResponse(BaseModel):
    anomalies: List[AnomalyRow]
    total: int


class AnomalyReviewRequest(BaseModel):
    action: str  # 'reviewed' | 'dismissed' | 'resolved'
    note: Optional[str] = None


# ---------- Challenges ----------

class ChallengeItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    status: str
    issued_at: datetime
    expires_at: datetime
    responded_at: Optional[datetime] = None


# ---------- Analytics ----------

class LayerSuccessRate(BaseModel):
    layer: str
    attempts: int
    successes: int
    failures: int
    success_rate: float  # [0, 1]


class AnalyticsSummary(BaseModel):
    from_date: date
    to_date: date
    total_sessions: int
    verified_sessions: int
    flagged_sessions: int
    attendance_rate: float  # [0, 1]
    anomaly_count_by_severity: dict  # {"low": n, "medium": n, ...}
    anomaly_count_by_type: dict
    layer_success_rates: List[LayerSuccessRate]


# Rebuild forward refs
SessionDetail.model_rebuild()