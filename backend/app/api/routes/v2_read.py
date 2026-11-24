# backend/app/api/routes/v2_read.py
"""
V2 read-only endpoints. Powers mobile History/Calendar and admin
Flagged Sessions/dashboards. All pure GET — no writes, no side effects.

Endpoints:
    GET /v2/students/{student_id}/sessions          — paginated history
    GET /v2/students/{student_id}/calendar          — per-day presence grid
    GET /v2/sessions/{session_id}                   — full session detail
    GET /v2/anomalies                               — flagged sessions list
    GET /v2/analytics/summary                       — dashboard aggregates
"""
from __future__ import annotations

import calendar as pycal
from datetime import datetime, date, timezone, timedelta
from typing import Optional, List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc, and_, or_
from sqlalchemy.orm import Session as DBSession

from ...models import (
    Student, Company, Internship, InternshipAssignment, Session,
    Anomaly, ContinuityCheck,
    VerificationEvent, PresenceChallenge,
)
from ...core.database import get_db
from ...core.config import settings
from ...schemas_v2 import (
    SessionListItem, SessionListResponse,
    CalendarDay, CalendarResponse,
    SessionDetail, VerificationEventItem, HeartbeatItem, AnomalyItem,
    ChallengeItem,
    AnomalyRow, AnomalyListResponse,
    LayerSuccessRate, AnalyticsSummary,
)

router = APIRouter(prefix="/v2", tags=["v2-read"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_student_or_404(db: DBSession, student_id: str) -> Student:
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")
    return student


def _company_tz(db: DBSession, company_id: Optional[int]) -> ZoneInfo:
    """Return the timezone for a company. Falls back to default."""
    if company_id:
        company = db.query(Company).filter(Company.id == company_id).first()
        if company and getattr(company, "timezone", None):
            try:
                return ZoneInfo(company.timezone)
            except Exception:
                pass
    try:
        return ZoneInfo(settings.DEFAULT_COMPANY_TZ)
    except Exception:
        return ZoneInfo("UTC")


def _session_to_item(db: DBSession, s: Session) -> SessionListItem:
    """Convert a Session row + related data into the list item shape."""
    company_name = None
    internship_name = None

    if s.company_id:
        company = db.query(Company).filter(Company.id == s.company_id).first()
        company_name = company.name if company else None

    if s.internship_id:
        internship = db.query(Internship).filter(Internship.id == s.internship_id).first()
        internship_name = internship.name if internship else None

    # duration: prefer stored; else compute for active sessions
    if s.total_duration_seconds is not None:
        duration_minutes = int(s.total_duration_seconds / 60)
    elif s.exit_time is None and s.entry_time is not None:
        duration_minutes = int((datetime.utcnow() - s.entry_time).total_seconds() / 60)
    else:
        duration_minutes = 0

    anomaly_count = db.query(func.count(Anomaly.id)).filter(
        Anomaly.session_id == s.id
    ).scalar() or 0

    return SessionListItem(
        id=s.id,
        session_id=s.session_id,
        internship_id=s.internship_id,
        company_name=company_name,
        internship_name=internship_name,
        started_at=s.entry_time,
        ended_at=s.exit_time,
        duration_minutes=duration_minutes,
        status=s.status,
        zkp_verified=getattr(s, "zkp_verified", None),
        face_verified=s.face_verified,
        wifi_verified=getattr(s, "wifi_verified", None),
        chain_verified=getattr(s, "chain_verified", None),
        overall_verified=getattr(s, "overall_verified", None),
        anomaly_count=anomaly_count,
    )


# ---------------------------------------------------------------------------
# 1) GET /v2/students/{student_id}/sessions — History list
# ---------------------------------------------------------------------------

@router.get("/students/{student_id}/sessions", response_model=SessionListResponse)
async def list_student_sessions(
    student_id: str,
    from_date: Optional[date] = Query(None, alias="from", description="YYYY-MM-DD (inclusive)"),
    to_date: Optional[date] = Query(None, alias="to", description="YYYY-MM-DD (inclusive)"),
    status: Optional[str] = Query(None, description="active|closed|flagged|abandoned"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: DBSession = Depends(get_db),
):
    """
    Paginated session history for a student. Most recent first.

    Filtering by `from`/`to` is done in UTC (sessions are stored UTC).
    """
    student = _get_student_or_404(db, student_id)

    q = db.query(Session).filter(Session.student_id == student.id)

    if from_date is not None:
        q = q.filter(Session.entry_time >= datetime.combine(from_date, datetime.min.time()))
    if to_date is not None:
        q = q.filter(Session.entry_time < datetime.combine(to_date + timedelta(days=1), datetime.min.time()))
    if status:
        q = q.filter(Session.status == status)

    total = q.count()
    rows = q.order_by(desc(Session.entry_time)).offset((page - 1) * limit).limit(limit).all()

    items = [_session_to_item(db, s) for s in rows]
    return SessionListResponse(sessions=items, total=total, page=page, limit=limit)


# ---------------------------------------------------------------------------
# 2) GET /v2/students/{student_id}/calendar — per-day presence
# ---------------------------------------------------------------------------

@router.get("/students/{student_id}/calendar", response_model=CalendarResponse)
async def get_student_calendar(
    student_id: str,
    month: str = Query(..., description="YYYY-MM"),
    db: DBSession = Depends(get_db),
):
    """
    Per-day presence grid for a month, bucketed in the company's timezone.

    Returns one entry per day in the month with `present: true` if at least
    one session existed that day, plus counts.
    """
    student = _get_student_or_404(db, student_id)

    try:
        year, mon = [int(x) for x in month.split("-")]
        assert 1 <= mon <= 12
    except Exception:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")

    # Determine the timezone from the student's most recent session's company
    latest_session = (
        db.query(Session)
        .filter(Session.student_id == student.id)
        .order_by(desc(Session.entry_time))
        .first()
    )
    tz = _company_tz(db, latest_session.company_id if latest_session else None)

    # Window in UTC that covers the entire month in `tz`
    month_start_local = datetime(year, mon, 1, 0, 0, tzinfo=tz)
    if mon == 12:
        next_month_local = datetime(year + 1, 1, 1, 0, 0, tzinfo=tz)
    else:
        next_month_local = datetime(year, mon + 1, 1, 0, 0, tzinfo=tz)

    month_start_utc = month_start_local.astimezone(timezone.utc).replace(tzinfo=None)
    next_month_utc = next_month_local.astimezone(timezone.utc).replace(tzinfo=None)

    sessions = (
        db.query(Session)
        .filter(
            Session.student_id == student.id,
            Session.entry_time >= month_start_utc,
            Session.entry_time < next_month_utc,
        )
        .all()
    )

    # Bucket sessions into days (in tz)
    days_in_month = pycal.monthrange(year, mon)[1]
    day_map = {}
    for d in range(1, days_in_month + 1):
        day_map[d] = {"session_count": 0, "verified_count": 0, "flagged_count": 0}

    for s in sessions:
        if s.entry_time is None:
            continue
        local_entry = s.entry_time.replace(tzinfo=timezone.utc).astimezone(tz)
        if local_entry.year == year and local_entry.month == mon:
            bucket = day_map[local_entry.day]
            bucket["session_count"] += 1
            if getattr(s, "overall_verified", None) is True:
                bucket["verified_count"] += 1
            if s.status == "flagged":
                bucket["flagged_count"] += 1

    days: List[CalendarDay] = []
    for d in range(1, days_in_month + 1):
        b = day_map[d]
        days.append(CalendarDay(
            day=date(year, mon, d),
            present=b["session_count"] > 0,
            session_count=b["session_count"],
            verified_count=b["verified_count"],
            flagged_count=b["flagged_count"],
        ))

    return CalendarResponse(
        student_id=student.student_id,
        month=f"{year:04d}-{mon:02d}",
        timezone=str(tz),
        days=days,
    )


# ---------------------------------------------------------------------------
# 3) GET /v2/sessions/{session_id} — full detail (admin drawer)
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}", response_model=SessionDetail)
async def get_session_detail(
    session_id: str,
    db: DBSession = Depends(get_db),
):
    """
    Full session detail: session + all events + heartbeats + anomalies + challenges.
    """
    s = db.query(Session).filter(Session.session_id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

    # Events (chronological)
    events = (
        db.query(VerificationEvent)
        .filter(VerificationEvent.session_id == s.id)
        .order_by(VerificationEvent.occurred_at.asc())
        .all()
    )

    heartbeats = (
        db.query(ContinuityCheck)
        .filter(ContinuityCheck.session_id == s.id)
        .order_by(ContinuityCheck.sequence_num.asc())
        .all()
    )

    anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.session_id == s.id)
        .order_by(Anomaly.id.asc())
        .all()
    )

    challenges = (
        db.query(PresenceChallenge)
        .filter(PresenceChallenge.session_id == s.id)
        .order_by(PresenceChallenge.issued_at.asc())
        .all()
    )

    return SessionDetail(
        session=_session_to_item(db, s),
        events=[
            VerificationEventItem(
                id=e.id, layer=e.layer, event_type=e.event_type,
                occurred_at=e.occurred_at,
                source_table=e.source_table, source_id=e.source_id,
            ) for e in events
        ],
        heartbeats=[
            HeartbeatItem(
                id=h.id,
                sequence_num=h.sequence_num,
                valid=h.valid,
                client_reported_at=h.client_reported_at,
                server_received_at=h.server_received_at,
                backfilled=h.backfilled,
            ) for h in heartbeats
        ],
        anomalies=[
            AnomalyItem(
                id=a.id, type=a.type, severity=a.severity,
                status=getattr(a, "status", "open"),
                description=a.description,
                detected_at=a.created_at,
                reviewed_at=getattr(a, "reviewed_at", None),
                reviewed_by=getattr(a, "reviewed_by", None),
                review_note=getattr(a, "review_note", None),
            ) for a in anomalies
        ],
        challenges=[
            ChallengeItem(
                id=c.id, session_id=c.session_id, status=c.status,
                issued_at=c.issued_at, expires_at=c.expires_at,
                responded_at=c.responded_at,
            ) for c in challenges
        ],
    )


# ---------------------------------------------------------------------------
# 4) GET /v2/anomalies — Flagged Sessions list
# ---------------------------------------------------------------------------

@router.get("/anomalies", response_model=AnomalyListResponse)
async def list_anomalies(
    status: Optional[str] = Query(None, description="open|reviewed|dismissed|resolved"),
    severity: Optional[str] = Query(None, description="low|medium|high|critical"),
    type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: DBSession = Depends(get_db),
):
    q = db.query(Anomaly)
    if status:
        q = q.filter(getattr(Anomaly, "status") == status)
    if severity:
        # Case-insensitive match (V1 wrote 'HIGH'/'MEDIUM', V2 writes 'high'/'medium')
        q = q.filter(func.lower(Anomaly.severity) == severity.lower())
    if type:
        q = q.filter(Anomaly.type == type)

    total = q.count()
    rows = q.order_by(desc(Anomaly.created_at)).offset((page - 1) * limit).limit(limit).all()

    items = []
    for a in rows:
        student = db.query(Student).filter(Student.id == a.student_id).first()
        company = db.query(Company).filter(Company.id == a.company_id).first()
        session = db.query(Session).filter(Session.id == a.session_id).first() if a.session_id else None

        items.append(AnomalyRow(
            id=a.id,
            session_id=a.session_id or 0,
            session_uuid=session.session_id if session else None,
            student_name=student.name if student else None,
            student_code=student.student_id if student else None,
            company_name=company.name if company else None,
            type=a.type,
            severity=a.severity,
            status=getattr(a, "status", "open"),
            description=a.description,
            detected_at=a.created_at,
            reviewed_at=getattr(a, "reviewed_at", None),
        ))

    return AnomalyListResponse(anomalies=items, total=total)


# ---------------------------------------------------------------------------
# 5) GET /v2/analytics/summary — dashboard aggregates
# ---------------------------------------------------------------------------

@router.get("/analytics/summary", response_model=AnalyticsSummary)
async def analytics_summary(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    db: DBSession = Depends(get_db),
):
    """
    Aggregates over a date range:
    - total_sessions, verified_sessions, flagged_sessions
    - attendance_rate = verified / total
    - anomaly counts by severity + type
    - layer success rates (from verification_events)
    """
    start = datetime.combine(from_date, datetime.min.time())
    end = datetime.combine(to_date + timedelta(days=1), datetime.min.time())

    sessions = (
        db.query(Session)
        .filter(Session.entry_time >= start, Session.entry_time < end)
        .all()
    )
    total_sessions = len(sessions)
    session_ids = [s.id for s in sessions]

    verified_sessions = sum(1 for s in sessions if getattr(s, "overall_verified", None) is True)
    flagged_sessions = sum(1 for s in sessions if s.status == "flagged")
    attendance_rate = (verified_sessions / total_sessions) if total_sessions else 0.0

    # Anomalies in range
    anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.session_id.in_(session_ids))
        .all() if session_ids else []
    )
    by_severity: dict = {}
    by_type: dict = {}
    for a in anomalies:
        sev = (a.severity or "unknown").lower()
        by_severity[sev] = by_severity.get(sev, 0) + 1
        by_type[a.type] = by_type.get(a.type, 0) + 1

    # Layer success rates from verification_events
    layer_rows = (
        db.query(
            VerificationEvent.layer,
            VerificationEvent.event_type,
            func.count(VerificationEvent.id),
        )
        .filter(VerificationEvent.session_id.in_(session_ids))
        .group_by(VerificationEvent.layer, VerificationEvent.event_type)
        .all()
    ) if session_ids else []

    layers: dict = {}
    for layer, etype, cnt in layer_rows:
        l = layers.setdefault(layer, {"attempts": 0, "successes": 0, "failures": 0})
        l["attempts"] += cnt
        if etype == "success":
            l["successes"] += cnt
        elif etype == "failure":
            l["failures"] += cnt

    layer_rates = [
        LayerSuccessRate(
            layer=layer,
            attempts=data["attempts"],
            successes=data["successes"],
            failures=data["failures"],
            success_rate=(data["successes"] / (data["successes"] + data["failures"]))
                         if (data["successes"] + data["failures"]) else 0.0,
        )
        for layer, data in sorted(layers.items())
    ]

    return AnalyticsSummary(
        from_date=from_date,
        to_date=to_date,
        total_sessions=total_sessions,
        verified_sessions=verified_sessions,
        flagged_sessions=flagged_sessions,
        attendance_rate=round(attendance_rate, 4),
        anomaly_count_by_severity=by_severity,
        anomaly_count_by_type=by_type,
        layer_success_rates=layer_rates,
    )