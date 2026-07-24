# backend/app/api/routes/student.py
"""
Student endpoints - Entry, Exit, GPS verification with QR
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from datetime import datetime
import time
import uuid
import logging

from ...models import Student, Internship, InternshipAssignment, Session, Company
from ...core.database import get_db
from ...schemas.student import (
    StudentEntryRequest,
    StudentEntryResponse,
    GPSVerificationRequest,
    GPSVerificationResponse,
)
from ...services.qr_service import QRService
from ...services.geofence import calculate_distance, verify_geofence

router = APIRouter(prefix="/student", tags=["student"])
logger = logging.getLogger(__name__)

# ✅ Singleton QRService
_qr_service = None

def get_qr_service():
    global _qr_service
    if _qr_service is None:
        _qr_service = QRService()
        logger.info("✅ QRService initialized")
    return _qr_service


# ==================== Start Entry ====================

@router.post("/start-entry")
async def start_entry(
    request: GPSVerificationRequest,
    db: DBSession = Depends(get_db)
):
    """
    Step 1: Student sends GPS coordinates.
    Server checks geofence, then generates QR automatically.
    """
    logger.info(f"📍 Start entry for student: {request.student_id}")
    
    # 1. Get student
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # 2. Get active internship
    assignment = db.query(InternshipAssignment).join(Internship).filter(
        InternshipAssignment.student_id == student.id,
        Internship.status == "active",
        InternshipAssignment.is_active == True
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="No active internship found")
    
    internship = db.query(Internship).filter(Internship.id == assignment.internship_id).first()
    company = db.query(Company).filter(Company.id == internship.company_id).first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # 3. Check if student already has active session
    existing_session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if existing_session:
        return {
            "verified": False,
            "message": "You already have an active session. Please exit first.",
            "qr_data": None
        }
    
    # 4. Check GPS within geofence
    distance = calculate_distance(
        request.latitude, request.longitude,
        company.geofence_center_lat, company.geofence_center_lng
    )
    
    is_within = distance <= company.geofence_radius
    
    if not is_within:
        return {
            "verified": False,
            "message": f"You are {distance:.2f}km away from the company. Please reach the location.",
            "qr_data": None
        }
    
    # 5. Generate QR challenge using singleton
    qr_service = get_qr_service()
    challenge = qr_service.generate_challenge(
        student_id=request.student_id,
        company_id=company.id,
        purpose="entry"
    )
    
    logger.info(f"✅ QR generated for {request.student_id}: {challenge.token[:8]}...")
    
    return {
        "verified": True,
        "message": "Location verified. QR generated automatically.",
        "qr_data": {
            "student_id": challenge.student_id,
            "company_id": challenge.company_id,
            "token": challenge.token,
            "timestamp": challenge.timestamp,
            "expires_at": challenge.expires_at,
            "purpose": "entry"
        }
    }


# ==================== Complete Entry ====================

@router.post("/complete-entry", response_model=StudentEntryResponse)
async def complete_entry(
    request: StudentEntryRequest,
    db: DBSession = Depends(get_db)
):
    """
    Step 2: Student completes entry with auto-detected QR.
    """
    logger.info(f"✅ Complete entry for student: {request.student_id}")
    logger.info(f"🔍 QR Token received: {request.qr_token[:8]}...")
    
    # 1. Verify QR token using singleton
    qr_service = get_qr_service()
    
    # Debug: Check what tokens are stored
    logger.info(f"📚 Stored tokens: {list(qr_service._challenges.keys())}")
    
    result = qr_service.verify_challenge(
        token=request.qr_token,
        student_id=request.student_id,
        company_id=request.company_id,
        purpose="entry"
    )
    
    if not result.valid:
        logger.error(f"❌ QR verification failed: {result.message}")
        raise HTTPException(status_code=400, detail=result.message)
    
    # 2. Get student
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # 3. Check if already has active session
    existing = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active session")
    
    # 4. Create session
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    entry_time = int(time.time())
    
    new_session = Session(
        session_id=session_id,
        student_id=student.id,
        company_id=request.company_id,
        entry_time=datetime.fromtimestamp(entry_time),
        qr_token=request.qr_token,
        status="active"
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    logger.info(f"✅ Session created: {session_id}")
    
    return StudentEntryResponse(
        session_id=session_id,
        message="Entry verified successfully. Session started.",
        entry_time=entry_time
    )


# ==================== Start Exit ====================

@router.post("/start-exit")
async def start_exit(
    request: GPSVerificationRequest,
    db: DBSession = Depends(get_db)
):
    """
    Step 1: Student sends GPS for exit verification.
    Generates exit QR automatically.
    """
    logger.info(f"📍 Start exit for student: {request.student_id}")
    
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if not session:
        return {
            "verified": False,
            "message": "No active session found. Please check in first.",
            "qr_data": None
        }
    
    company = db.query(Company).filter(Company.id == session.company_id).first()
    
    # Check GPS (optional, with warning)
    if company:
        distance = calculate_distance(
            request.latitude, request.longitude,
            company.geofence_center_lat, company.geofence_center_lng
        )
        
        is_within = distance <= company.geofence_radius
        
        if not is_within:
            return {
                "verified": True,
                "message": f"You are {distance:.2f}km away from the company. Exit will still be recorded.",
                "qr_data": None
            }
    
    # Generate exit QR using singleton
    qr_service = get_qr_service()
    challenge = qr_service.generate_challenge(
        student_id=request.student_id,
        company_id=session.company_id,
        purpose="exit"
    )
    
    logger.info(f"✅ Exit QR generated for {request.student_id}: {challenge.token[:8]}...")
    
    return {
        "verified": True,
        "message": "Exit QR generated automatically.",
        "qr_data": {
            "student_id": challenge.student_id,
            "company_id": challenge.company_id,
            "token": challenge.token,
            "timestamp": challenge.timestamp,
            "expires_at": challenge.expires_at,
            "purpose": "exit"
        }
    }


# ==================== Complete Exit ====================

@router.post("/complete-exit")
async def complete_exit(
    request: StudentEntryRequest,
    db: DBSession = Depends(get_db)
):
    """
    Step 2: Student completes exit with auto-detected QR.
    """
    logger.info(f"✅ Complete exit for student: {request.student_id}")
    
    qr_service = get_qr_service()
    result = qr_service.verify_challenge(
        token=request.qr_token,
        student_id=request.student_id,
        company_id=request.company_id,
        purpose="exit"
    )
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.message)
    
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    
    exit_timestamp = int(time.time())
    duration_seconds = exit_timestamp - int(session.entry_time.timestamp())
    
    session.exit_time = datetime.fromtimestamp(exit_timestamp)
    session.status = "completed"
    session.total_duration_seconds = duration_seconds
    
    db.commit()
    
    logger.info(f"✅ Session closed: {session.session_id}, Duration: {duration_seconds}s")
    
    return {
        "session_id": session.session_id,
        "duration_seconds": duration_seconds,
        "duration_minutes": duration_seconds // 60,
        "message": "Exit successful"
    }


# ==================== Dashboard ====================

@router.get("/dashboard")
async def get_student_dashboard(
    student_id: str,
    db: DBSession = Depends(get_db)
):
    """Get student dashboard data"""
    logger.info(f"📊 Dashboard requested for: {student_id}")
    
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    assignment = db.query(InternshipAssignment).join(Internship).filter(
        InternshipAssignment.student_id == student.id,
        InternshipAssignment.is_active == True
    ).first()
    
    active_internship = None
    if assignment:
        internship = db.query(Internship).filter(Internship.id == assignment.internship_id).first()
        company = db.query(Company).filter(Company.id == internship.company_id).first()
        
        if internship:
            session = db.query(Session).filter(
                Session.student_id == student.id,
                Session.status == "active"
            ).first()
            
            active_internship = {
                "internship_id": internship.id,
                "company_name": company.name if company else "Unknown",
                "role_name": internship.name,
                "daily_start": str(internship.daily_start_time) if internship.daily_start_time else "09:00",
                "daily_end": str(internship.daily_end_time) if internship.daily_end_time else "17:00",
                "is_paid": internship.is_paid,
                "stipend_amount": internship.stipend_amount,
                "can_start": not session,
                "status_message": "Active session in progress" if session else "Ready to check in"
            }
    
    return {
        "student": {
            "student_id": student.student_id,
            "name": student.name,
            "email": student.email
        },
        "active_internship": active_internship
    }


# ==================== Active Session ====================

@router.get("/active-session/{student_id}")
async def get_active_session(
    student_id: str,
    db: DBSession = Depends(get_db)
):
    """Get active session for student"""
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
            "duration_minutes": int((time.time() - session.entry_time.timestamp()) / 60)
        }
    }