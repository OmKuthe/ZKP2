# backend/app/api/routes/v2_reports.py
"""
CSV report downloads.

Two endpoints:
    GET /v2/reports/student/{student_id}/sessions.csv?from=&to=
    GET /v2/reports/internship/{internship_id}/attendance.csv?from=&to=

Both return Content-Type: text/csv with a Content-Disposition header
that triggers a browser download.

`from` and `to` are optional ISO dates (YYYY-MM-DD). If absent, all
sessions in the student's / internship's range are included.
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session as DBSession

from ...models import (
    Student, Session, Company, Internship, InternshipAssignment, Anomaly,
)
from ...core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/reports", tags=["v2-reports"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _csv_response(rows: list[list], header: list[str], filename: str) -> StreamingResponse:
    """Build a StreamingResponse that is a properly formed CSV file."""
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _fmt_dt(v) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    return str(v)


def _fmt_date(v) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, date):
        return v.strftime("%Y-%m-%d")
    return str(v)


def _verification_bool(v) -> str:
    """'yes' / 'no' / '' for None."""
    if v is True:  return "yes"
    if v is False: return "no"
    return ""


def _apply_date_filter(q, column, from_date: Optional[date], to_date: Optional[date]):
    if from_date is not None:
        q = q.filter(column >= datetime.combine(from_date, datetime.min.time()))
    if to_date is not None:
        q = q.filter(column < datetime.combine(to_date + timedelta(days=1), datetime.min.time()))
    return q


# ---------------------------------------------------------------------------
# 1) Student sessions CSV
# ---------------------------------------------------------------------------

@router.get("/student/{student_id}/sessions.csv")
async def student_sessions_csv(
    student_id: str,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: DBSession = Depends(get_db),
):
    """Download all sessions for one student as CSV."""
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    q = db.query(Session).filter(Session.student_id == student.id)
    q = _apply_date_filter(q, Session.entry_time, from_date, to_date)
    sessions = q.order_by(desc(Session.entry_time)).all()

    header = [
        "session_id", "date", "entry_time_utc", "exit_time_utc",
        "duration_minutes", "status",
        "zkp_verified", "face_verified", "wifi_verified", "chain_verified",
        "overall_verified", "anomaly_count",
    ]

    rows: list[list] = []
    for s in sessions:
        anom_count = db.query(Anomaly).filter(Anomaly.session_id == s.id).count()
        rows.append([
            s.session_id,
            _fmt_date(s.entry_time),
            _fmt_dt(s.entry_time),
            _fmt_dt(s.exit_time),
            int((s.total_duration_seconds or 0) / 60) if s.total_duration_seconds else 0,
            s.status or "",
            _verification_bool(s.zkp_verified),
            _verification_bool(s.face_verified),
            _verification_bool(s.wifi_verified),
            _verification_bool(s.chain_verified),
            _verification_bool(s.overall_verified),
            anom_count,
        ])

    date_range = ""
    if from_date or to_date:
        date_range = f"_{from_date or 'start'}_{to_date or 'end'}"
    filename = f"student_{student.student_id}{date_range}_sessions.csv"

    return _csv_response(rows, header, filename)


# ---------------------------------------------------------------------------
# 2) Internship-wide attendance CSV
# ---------------------------------------------------------------------------

@router.get("/internship/{internship_id}/attendance.csv")
async def internship_attendance_csv(
    internship_id: int,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: DBSession = Depends(get_db),
):
    """
    Download all sessions for every student in an internship as one CSV,
    sorted by student then date. Includes student_id and name as the first
    two columns so the file is self-describing.
    """
    internship = db.query(Internship).filter(Internship.id == internship_id).first()
    if not internship:
        raise HTTPException(status_code=404, detail=f"Internship {internship_id} not found")

    # Get all students assigned to this internship (active or historical)
    assignments = (
        db.query(InternshipAssignment)
        .filter(InternshipAssignment.internship_id == internship_id)
        .all()
    )
    student_ids = [a.student_id for a in assignments]

    if not student_ids:
        # Empty CSV with just headers — valid response
        header = [
            "student_id", "student_name", "session_id", "date",
            "entry_time_utc", "exit_time_utc", "duration_minutes", "status",
            "zkp_verified", "face_verified", "wifi_verified", "chain_verified",
            "overall_verified", "anomaly_count",
        ]
        return _csv_response([], header, f"internship_{internship_id}_attendance.csv")

    q = db.query(Session).filter(Session.student_id.in_(student_ids))
    q = _apply_date_filter(q, Session.entry_time, from_date, to_date)
    sessions = q.all()

    # Map student_id (PK) → Student row for name lookup
    students = db.query(Student).filter(Student.id.in_(student_ids)).all()
    student_by_pk = {s.id: s for s in students}

    # Sort by student_code then date descending
    def sort_key(s):
        st = student_by_pk.get(s.student_id)
        return (st.student_id if st else "", s.entry_time or datetime.min)

    sessions.sort(key=sort_key)

    header = [
        "student_id", "student_name", "session_id", "date",
        "entry_time_utc", "exit_time_utc", "duration_minutes", "status",
        "zkp_verified", "face_verified", "wifi_verified", "chain_verified",
        "overall_verified", "anomaly_count",
    ]

    rows: list[list] = []
    for s in sessions:
        st = student_by_pk.get(s.student_id)
        anom_count = db.query(Anomaly).filter(Anomaly.session_id == s.id).count()
        rows.append([
            st.student_id if st else "",
            st.name if st else "",
            s.session_id,
            _fmt_date(s.entry_time),
            _fmt_dt(s.entry_time),
            _fmt_dt(s.exit_time),
            int((s.total_duration_seconds or 0) / 60) if s.total_duration_seconds else 0,
            s.status or "",
            _verification_bool(s.zkp_verified),
            _verification_bool(s.face_verified),
            _verification_bool(s.wifi_verified),
            _verification_bool(s.chain_verified),
            _verification_bool(s.overall_verified),
            anom_count,
        ])

    date_range = ""
    if from_date or to_date:
        date_range = f"_{from_date or 'start'}_{to_date or 'end'}"
    filename = f"internship_{internship_id}{date_range}_attendance.csv"

    return _csv_response(rows, header, filename)