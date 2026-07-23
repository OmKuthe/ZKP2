# backend/app/api/routes/student.py
"""
Student endpoints - Entry, Exit, GPS verification
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from datetime import datetime
import time
import uuid

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


@router.post("/verify-location", response_model=GPSVerificationResponse)
async def verify_location(
    request: GPSVerificationRequest,
    db: DBSession = Depends(get_db)
):
    """
    Step 1: Student sends GPS coordinates.
    Server checks if they are within geofence.
    """
    # Get student
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get active internship for this student
    assignment = db.query(InternshipAssignment).join(Internship).filter(
        InternshipAssignment.student_id == student.id,
        Internship.status == "active"
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="No active internship found for this student")
    
    internship = db.query(Internship).filter(Internship.id == assignment.internship_id).first()
    company = db.query(Company).filter(Company.id == internship.company_id).first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check if GPS is within geofence
    distance = calculate_distance(
        request.latitude, request.longitude,
        company.geofence_center_lat, company.geofence_center_lng
    )
    
    is_within = distance <= company.geofence_radius
    
    if not is_within:
        return GPSVerificationResponse(
            verified=False,
            message=f"You are {distance:.2f}km away from the company. Please reach the location.",
            distance=distance,
            max_distance=company.geofence_radius
        )
    
    # Check if student already has an active session
    existing_session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if existing_session:
        return GPSVerificationResponse(
            verified=False,
            message="You already have an active session. Please exit first.",
            distance=distance,
            max_distance=company.geofence_radius
        )
    
    # Generate QR challenge
    qr_service = QRService()
    challenge = qr_service.generate_challenge(
        student_id=request.student_id,
        company_id=company.id,
        purpose="entry"
    )
    
    return GPSVerificationResponse(
        verified=True,
        message="Location verified. QR challenge generated.",
        distance=distance,
        max_distance=company.geofence_radius,
        qr_token=challenge.token,
        qr_payload={
            "student_id": challenge.student_id,
            "company_id": challenge.company_id,
            "token": challenge.token,
            "timestamp": challenge.timestamp,
            "expires_at": challenge.expires_at,
        }
    )


@router.post("/entry", response_model=StudentEntryResponse)
async def student_entry(
    request: StudentEntryRequest,
    db: DBSession = Depends(get_db)
):
    """
    Step 2: Student completes entry with QR verification.
    """
    # Verify QR token
    qr_service = QRService()
    result = qr_service.verify_challenge(
        token=request.qr_token,
        student_id=request.student_id,
        company_id=request.company_id,
        purpose="entry"
    )
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.message)
    
    # Get student
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check if student already has an active session
    existing = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active session")
    
    # Create session
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
    
    return StudentEntryResponse(
        session_id=session_id,
        message="Entry verified successfully. Session started.",
        entry_time=entry_time
    )


@router.post("/exit")
async def student_exit(
    request: StudentEntryRequest,
    db: DBSession = Depends(get_db)
):
    """
    Student exit with QR verification.
    """
    # Verify QR token
    qr_service = QRService()
    result = qr_service.verify_challenge(
        token=request.qr_token,
        student_id=request.student_id,
        company_id=request.company_id,
        purpose="exit"
    )
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.message)
    
    # Get student
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get active session
    session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    
    # Close session
    exit_timestamp = int(time.time())
    duration_seconds = exit_timestamp - int(session.entry_time.timestamp())
    
    session.exit_time = datetime.fromtimestamp(exit_timestamp)
    session.status = "completed"
    session.total_duration_seconds = duration_seconds
    
    db.commit()
    
    return {
        "session_id": session.session_id,
        "duration_seconds": duration_seconds,
        "duration_minutes": duration_seconds // 60,
        "message": "Exit successful"
    }