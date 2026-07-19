# backend/app/api/routes/qr.py
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
import time
import uuid

from ...services.qr_service import QRService
from ...schemas.qr import (
    QRRequest,
    QRResponse,
    EntryRequest,
    EntryResponse,
    ExitRequest,
    ExitResponse,
)
from ...models import Session, Student
from ...core.database import get_db
from sqlalchemy.orm import Session as DBSession

router = APIRouter()

# Singleton QRService
_qr_service = None

def get_qr_service() -> QRService:
    global _qr_service
    if _qr_service is None:
        _qr_service = QRService()
    return _qr_service


# ==================== Endpoints ====================

@router.post("/request-qr", response_model=QRResponse)
async def request_qr(
    request: QRRequest,
    purpose: str = Query("entry", description="'entry' or 'exit'"),
    qr_service: QRService = Depends(get_qr_service),
    db: DBSession = Depends(get_db)
):
    """
    Request a QR challenge.

    - purpose='entry': Only works if no active session exists
    - purpose='exit': Only works if an active session exists
    """
    # Validate student
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.company_id != request.company_id:
        raise HTTPException(status_code=403, detail="Student is not assigned to this company")

    # Check active session
    active_session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()

    if purpose == "entry":
        if active_session:
            raise HTTPException(status_code=400, detail="You already have an active session. Use exit QR to end it.")
    elif purpose == "exit":
        if not active_session:
            raise HTTPException(status_code=400, detail="No active session found. Use entry QR to start one.")
    else:
        raise HTTPException(status_code=400, detail="Invalid purpose. Use 'entry' or 'exit'")

    # Generate QR challenge with purpose
    challenge = qr_service.generate_challenge(
        student_id=request.student_id,
        company_id=request.company_id,
        purpose=purpose
    )

    qr_payload = {
        "student_id": challenge.student_id,
        "company_id": challenge.company_id,
        "token": challenge.token,
        "purpose": challenge.purpose,
        "timestamp": challenge.timestamp,
        "expires_at": challenge.expires_at,
    }

    return QRResponse(
        qr_data=qr_payload,
        expires_in=qr_service.challenge_ttl,
        message=f"QR challenge generated for {purpose}."
    )


@router.post("/entry", response_model=EntryResponse)
async def create_session(
    request: EntryRequest,
    qr_service: QRService = Depends(get_qr_service),
    db: DBSession = Depends(get_db)
):
    """Complete entry with QR verification"""
    result = qr_service.verify_challenge(
        token=request.qr_token,
        student_id=request.student_id,
        company_id=request.company_id,
        purpose="entry"
    )
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.message)

    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.company_id != request.company_id:
        raise HTTPException(status_code=403, detail="Student is not assigned to this company")

    existing_session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    if existing_session:
        raise HTTPException(status_code=400, detail="You already have an active session")

    session_id = f"session_{uuid.uuid4().hex[:12]}"
    entry_time = int(time.time())

    new_session = Session(
        session_id=session_id,
        student_id=student.id,
        company_id=student.company_id,
        entry_time=datetime.fromtimestamp(entry_time),
        qr_token=request.qr_token,
        status="active"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return EntryResponse(
        session_id=session_id,
        message="Entry verified successfully. Session started.",
        entry_time=entry_time
    )


@router.post("/exit", response_model=ExitResponse)
async def exit_session(
    request: ExitRequest,
    qr_service: QRService = Depends(get_qr_service),
    db: DBSession = Depends(get_db)
):
    """Exit with QR verification"""
    session = db.query(Session).filter(
        Session.session_id == request.session_id,
        Session.status == "active"
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    student = db.query(Student).filter(Student.id == session.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    result = qr_service.verify_challenge(
        token=request.qr_token,
        student_id=student.student_id,
        company_id=session.company_id,
        purpose="exit"
    )
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.message)

    entry_timestamp = int(session.entry_time.timestamp())
    exit_timestamp = int(time.time())
    duration_seconds = exit_timestamp - entry_timestamp

    session.exit_time = datetime.fromtimestamp(exit_timestamp)
    session.status = "completed"
    session.total_duration_seconds = duration_seconds
    db.commit()

    return ExitResponse(
        session_id=session.session_id,
        duration_seconds=duration_seconds,
        status="completed",
        message=f"Session ended. Duration: {duration_seconds // 60} minutes."
    )


@router.get("/active/{student_id}")
async def get_active_session(
    student_id: str,
    db: DBSession = Depends(get_db)
):
    """Get active session for a student"""
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if not session:
        return {"active": False, "session": None}
    
    return {
        "active": True,
        "session": {
            "session_id": session.session_id,
            "entry_time": session.entry_time,
            "status": session.status,
            "duration_minutes": int((time.time() - session.entry_time.timestamp()) / 60)
        }
    }


@router.get("/history/{student_id}")
async def get_session_history(
    student_id: str,
    limit: int = 10,
    db: DBSession = Depends(get_db)
):
    """Get session history for a student"""
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    sessions = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status != "active"
    ).order_by(Session.entry_time.desc()).limit(limit).all()
    
    return {
        "total": len(sessions),
        "sessions": [
            {
                "session_id": s.session_id,
                "entry_time": s.entry_time,
                "exit_time": s.exit_time,
                "duration_minutes": int(s.total_duration_seconds / 60) if s.total_duration_seconds else 0,
                "status": s.status
            }
            for s in sessions
        ]
    }
