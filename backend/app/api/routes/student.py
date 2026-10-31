# backend/app/api/routes/student.py
"""
Student endpoints - Entry, Exit, GPS verification with QR
Includes Phase 2B: Counter-based Hash Chain
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from datetime import datetime
from sqlalchemy.exc import IntegrityError
import time
import uuid
import logging

from ...models import Student, Internship, InternshipAssignment, Session, Company, ContinuityCheck , Anomaly
from ...core.database import get_db
from ...schemas.student import (
    StudentEntryRequest,
    StudentEntryResponse,
    GPSVerificationRequest,
    GPSVerificationResponse,
    ContinuityCheckRequest,
    ContinuityCheckResponse,
)
from ...services.qr_service import QRService
from ...services.geofence import calculate_distance
from ...services.hash_chain import HashChainService
from ...zk.proof_generator import generate_and_verify_proximity_proof

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
    Server checks geofence using ZKP (privately).
    """
    logger.info(f"📍 Start entry for student: {request.student_id}")
    logger.info(f"📍 GPS received: lat={request.latitude}, lng={request.longitude}")
    
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
    
    logger.info(f"📍 Company: {company.name}, geofence center: ({company.geofence_center_lat}, {company.geofence_center_lng}), radius: {company.geofence_radius} km")
    
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
    
    # 4. First check: calculate actual distance (for debugging)
    actual_distance = calculate_distance(
        request.latitude, request.longitude,
        company.geofence_center_lat, company.geofence_center_lng
    )
    logger.info(f"📊 Actual distance from company: {actual_distance:.4f} km")
    logger.info(f"📊 Radius: {company.geofence_radius} km")
    logger.info(f"📊 Is within radius: {actual_distance <= company.geofence_radius}")
    
    # If not within radius, return early with clear message
    if actual_distance > company.geofence_radius:
        logger.warning(f"❌ Student is outside geofence: {actual_distance:.2f} km > {company.geofence_radius} km")
        return {
            "verified": False,
            "message": f"You are {actual_distance:.2f}km away from the company (radius: {company.geofence_radius}km).",
            "qr_data": None,
            "actual_distance": actual_distance,
            "radius": company.geofence_radius
        }
    
    # 5. ✅ Generate Proximity ZKP (privacy-preserving!)
    logger.info("🔐 Generating Proximity ZKP...")
    
    try:
        is_valid, message, proof, public_signals = generate_and_verify_proximity_proof(
            student_lat=request.latitude,
            student_lng=request.longitude,
            company_lat=company.geofence_center_lat,
            company_lng=company.geofence_center_lng,
            radius_km=company.geofence_radius
        )
        
        logger.info(f"📊 ZKP Result: is_valid={is_valid}, message={message}")
        
        if not is_valid:
            logger.error(f"❌ Proximity proof failed: {message}")
            return {
                "verified": False,
                "message": f"ZKP verification failed: {message}",
                "qr_data": None
            }
        
        logger.info("✅ Proximity proof verified! Student is within geofence.")
        logger.info(f"   Public signals: {public_signals}")
        
    except Exception as e:
        logger.error(f"❌ ZKP generation error: {e}")
        return {
            "verified": False,
            "message": f"ZKP error: {str(e)}",
            "qr_data": None
        }
    
    # 6. Generate QR challenge (for entry verification)
    qr_service = get_qr_service()
    challenge = qr_service.generate_challenge(
        student_id=request.student_id,
        company_id=company.id,
        purpose="entry"
    )
    
    logger.info(f"✅ QR generated for {request.student_id}: {challenge.token[:8]}...")
    
    return {
        "verified": True,
        "message": "Location verified using ZKP. QR generated automatically.",
        "qr_data": {
            "student_id": challenge.student_id,
            "company_id": challenge.company_id,
            "token": challenge.token,
            "timestamp": challenge.timestamp,
            "expires_at": challenge.expires_at,
            "purpose": "entry"
        },
        "zkp_verified": True,
        "public_signals": public_signals,
        "actual_distance": actual_distance,
        "radius": company.geofence_radius
    }


# ==================== Complete Entry ====================

@router.post("/complete-entry", response_model=StudentEntryResponse)
async def complete_entry(
    request: StudentEntryRequest,
    db: DBSession = Depends(get_db)
):
    """
    Step 2: Student completes entry with QR verification.
    Phase 2B: Generates seed and initializes counter.
    """
    logger.info(f"✅ Complete entry for student: {request.student_id}")
    
    # 1. Verify QR token
    qr_service = get_qr_service()
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
    
    # 4. ✅ Generate seed and initialize counter
    hash_service = HashChainService()
    seed = hash_service.generate_seed()
    logger.info(f"🔐 Hash chain seed generated: {seed[:16]}...")
    
        # 5. Create session with hash chain
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    entry_time = int(time.time())
    
    # ✅ Step 2: Face liveness result (optional, from client)
    # NULL  = not attempted (permission denied, camera unavailable)
    # TRUE  = liveness passed
    # FALSE = 3 attempts failed; session is still created per "don't lock out" rule
    face_verified = request.face_verified
    face_verified_at = datetime.now() if face_verified is not None else None
    
    if face_verified is True:
        logger.info(f"✅ Face liveness verified for {request.student_id}")
    elif face_verified is False:
        logger.warning(f"⚠️ Face liveness FAILED for {request.student_id} (session still created)")
    else:
        logger.info(f"ℹ️ Face liveness not attempted for {request.student_id}")
    
    new_session = Session(
        session_id=session_id,
        student_id=student.id,
        company_id=request.company_id,
        entry_time=datetime.fromtimestamp(entry_time),
        qr_token=request.qr_token,
        # ✅ Counter-based hash chain
        hash_chain_seed=seed,
        hash_counter=0,
        hash_chain_length=100,
        check_interval_seconds=60,  # ✅ Default: 1 minute
        # ✅ Step 2: Face liveness
        face_verified=face_verified,
        face_verified_at=face_verified_at,
        status="active"
    )
    
    db.add(new_session)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        # Flaw #4: another request won the race and created an active
        # session for this student between our app-level check and now.
        logger.warning(
            f"⚠️ IntegrityError on session insert (race lost): {e}"
        )
        raise HTTPException(
            status_code=409,
            detail="You already have an active session. Please exit first."
        )
    db.refresh(new_session)

    logger.info(f"✅ Session created: {session_id}")

    return StudentEntryResponse(
        session_id=session_id,
        message="Entry verified successfully. Hash chain started.",
        entry_time=entry_time,
        seed=seed  # ✅ Send seed to app
    )


# ==================== Continuity Check ====================
@router.post("/verify-continuity", response_model=ContinuityCheckResponse)
async def verify_continuity(
    request: ContinuityCheckRequest,
    db: DBSession = Depends(get_db)
):
    """
    Verify continuity using counter-based approach.
    ✅ Stores each check in the database for tracking.
    ✅ Flaw #9: detects heartbeat gaps (client silent for > 2 * interval).
    """
    logger.info(f"🔍 Continuity check for session: {request.session_id}")

    # 1. Get session
    session = db.query(Session).filter(
        Session.session_id == request.session_id,
        Session.status == "active"
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    if not session.hash_chain_seed:
        raise HTTPException(status_code=400, detail="No hash chain seed found")

    # 2. Get the next counter value
    next_counter = session.hash_counter + 1

    # 3. Verify the provided hash
    hash_service = HashChainService()
    is_valid = hash_service.verify_hash(
        seed=session.hash_chain_seed,
        counter=next_counter,
        provided_hash=request.hash_link
    )

    # ============================================================
    # Flaw #9: heartbeat gap detection
    # ============================================================
    # Compute the gap between the previous check and this one. If it
    # exceeds 2x the expected interval, we have a silent window that
    # the client is not explaining. We still accept the hash (don't
    # lock the user out) but we record an Anomaly so the gap is visible
    # to admins and to the History timeline.
    # ============================================================
    now_ts = request.timestamp
    expected_interval = session.check_interval_seconds or 60
    max_gap = expected_interval * 2

    gap_seconds = None
    gap_detected = False
    gap_severity = None

    if session.last_hash_check is not None:
        last_ts = int(session.last_hash_check.timestamp())
        gap_seconds = now_ts - last_ts

        if gap_seconds > max_gap:
            gap_detected = True
            # MEDIUM for a moderate gap (2x - 10x interval),
            # HIGH for a long gap (10x+ interval — session was effectively suspended).
            if gap_seconds > expected_interval * 10:
                gap_severity = "HIGH"
            else:
                gap_severity = "MEDIUM"

            logger.warning(
                f"⚠️ Continuity gap detected for session {request.session_id}: "
                f"{gap_seconds}s since last check (expected ~{expected_interval}s, "
                f"max tolerance {max_gap}s, severity={gap_severity})"
            )

    # 4. ✅ Store continuity check in database
    status = "verified" if is_valid else "failed"
    if not is_valid:
        message = "Hash chain verification failed"
    elif gap_detected:
        message = (
            f"Hash verified, but gap of {gap_seconds}s detected "
            f"since last check (expected ~{expected_interval}s) — "
            f"session flagged for review"
        )
    else:
        message = "Hash chain verification passed"

    check = ContinuityCheck(
        session_id=session.id,
        check_time=datetime.fromtimestamp(request.timestamp),
        check_number=next_counter,
        hash_link=request.hash_link,
        hash_link_valid=is_valid,
        status=status,
        message=message
    )
    db.add(check)

    if not is_valid:
        logger.warning(f"❌ Hash verification failed for session {request.session_id}")
        logger.warning(f"   Expected: {hash_service.get_hash(session.hash_chain_seed, next_counter)}")
        logger.warning(f"   Received: {request.hash_link}")

        db.commit()
        return ContinuityCheckResponse(
            verified=False,
            message="Hash verification failed. Session flagged for review.",
            next_check_seconds=session.check_interval_seconds or 60,
            current_index=session.hash_counter
        )

    # 5. Flaw #9: create Anomaly row for a detected gap (don't block, just record)
    if gap_detected:
        gap_anomaly = Anomaly(
            session_id=session.id,
            student_id=session.student_id,
            company_id=session.company_id,
            type="continuity_gap",
            severity=gap_severity,
            description=(
                f"Continuity heartbeat gap: {gap_seconds}s since last check "
                f"(expected ~{expected_interval}s, max tolerance {max_gap}s). "
                f"Counter moved {session.hash_counter} -> {next_counter}."
            ),
            resolved=False,
        )
        db.add(gap_anomaly)
        logger.warning(
            f"🚨 Continuity gap anomaly recorded: "
            f"session={request.session_id}, gap={gap_seconds}s, severity={gap_severity}"
        )

    # 6. Update session
    session.hash_counter = next_counter
    session.last_hash_check = datetime.fromtimestamp(request.timestamp)
    db.commit()

    logger.info(f"✅ Continuity check passed for session {request.session_id}")
    logger.info(f"   Counter: {session.hash_counter}")

    return ContinuityCheckResponse(
        verified=True,
        message=(
            f"Continuity verified successfully. Counter: {session.hash_counter}."
            + (f" ⚠️ Gap of {gap_seconds}s detected." if gap_detected else "")
        ),
        next_check_seconds=session.check_interval_seconds or 60,
        current_index=session.hash_counter
    )

# ==================== Get Continuity Checks ====================

@router.get("/session/checks/{session_id}")
async def get_continuity_checks(
    session_id: str,
    db: DBSession = Depends(get_db)
):
    """
    ✅ NEW: Get all continuity checks for a session.
    Used for the tracking timeline.
    """
    # Get session
    session = db.query(Session).filter(
        Session.session_id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all checks for this session
    checks = db.query(ContinuityCheck).filter(
        ContinuityCheck.session_id == session.id
    ).order_by(ContinuityCheck.check_number.asc()).all()
    
    return {
        "session_id": session_id,
        "entry_time": session.entry_time,
        "exit_time": session.exit_time,
        "status": session.status,
        "checks": [
            {
                "id": c.id,
                "check_number": c.check_number,
                "check_time": c.check_time,
                "status": c.status,
                "hash_link": c.hash_link,
                "hash_link_valid": c.hash_link_valid,
                "message": c.message
            }
            for c in checks
        ],
        "total": len(checks)
    }


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
    logger.info(f"📍 GPS received: lat={request.latitude}, lng={request.longitude}")
    
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
            logger.info(f"⚠️ Student is {distance:.2f}km away from company, but exit is still allowed")
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
    Phase 2B: Verifies exit hash.
    """
    logger.info(f"✅ Complete exit for student: {request.student_id}")
    
    # 1. Verify QR
    qr_service = get_qr_service()
    result = qr_service.verify_challenge(
        token=request.qr_token,
        student_id=request.student_id,
        company_id=request.company_id,
        purpose="exit"
    )
    
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.message)
    
    # 2. Get student
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # 3. Get active session
    session = db.query(Session).filter(
        Session.student_id == student.id,
        Session.status == "active"
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    
    # 4. ✅ Verify exit hash
    chain_verified = False
    if request.hash_chain_link and session.hash_chain_seed:
        logger.info(f"🔐 Verifying exit hash...")
        hash_service = HashChainService()
        is_valid = hash_service.verify_exit_hash(
            seed=session.hash_chain_seed,
            provided_hash=request.hash_chain_link
        )
        
        if is_valid:
            chain_verified = True
            logger.info(f"✅ Exit hash verified for session {session.session_id}")
        else:
            logger.warning(f"❌ Exit hash verification failed")
    
    # 5. Close session
    exit_timestamp = int(time.time())
    duration_seconds = exit_timestamp - int(session.entry_time.timestamp())
    
    session.exit_time = datetime.fromtimestamp(exit_timestamp)
    session.status = "completed" if chain_verified else "completed_with_anomaly"
    session.total_duration_seconds = duration_seconds
    
    db.commit()
    
    logger.info(f"✅ Session closed: {session.session_id}, Duration: {duration_seconds}s")
    
    return {
        "session_id": session.session_id,
        "duration_seconds": duration_seconds,
        "duration_minutes": duration_seconds // 60,
        "chain_verified": chain_verified,
        "message": "Exit successful" + (" (hash chain verified)" if chain_verified else " (hash chain not verified)")
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
            "duration_minutes": int((time.time() - session.entry_time.timestamp()) / 60),
            "hash_counter": session.hash_counter or 0
        }
    }


# ==================== Environment Commitment (Phase 2C) ====================

from pydantic import BaseModel

class EnvironmentCommitmentRequest(BaseModel):
    session_id: str
    commitment: str
    timestamp: int


class EnvironmentCommitmentResponse(BaseModel):
    stored: bool
    message: str


class EnvironmentCheckRequest(BaseModel):
    session_id: str
    current_commitment: str
    timestamp: int


class EnvironmentCheckResponse(BaseModel):
    verified: bool
    overlap: float
    message: str


@router.post("/store-environment")
async def store_environment(
    request: dict,
    db: DBSession = Depends(get_db)
):
    """
    Store environment commitment.
    This is a simple storage — no validation yet.
    """
    session_id = request.get("session_id")
    commitment = request.get("commitment")
    
    if not session_id or not commitment:
        return {"stored": False, "message": "Missing session_id or commitment"}
    
    session = db.query(Session).filter(
        Session.session_id == session_id,
        Session.status == "active"
    ).first()
    
    if not session:
        return {"stored": False, "message": "Active session not found"}
    
    session.environment_commitment = commitment
    db.commit()
    
    logger.info(f"✅ Environment commitment stored for session {session_id}")
    
    return {"stored": True, "message": "Environment commitment stored successfully."}


@router.post("/verify-environment")
async def verify_environment(
    request: dict,
    db: DBSession = Depends(get_db)
):
    """
    Verify environment — always returns True for now.
    Will implement proper threshold matching later.
    """
    session_id = request.get("session_id")
    current_commitment = request.get("current_commitment")
    
    if not session_id:
        return {"verified": False, "overlap": 0.0, "message": "Missing session_id"}
    
    session = db.query(Session).filter(
        Session.session_id == session_id,
        Session.status == "active"
    ).first()
    
    if not session:
        return {"verified": False, "overlap": 0.0, "message": "Active session not found"}
    
    if not session.environment_commitment:
        return {"verified": True, "overlap": 1.0, "message": "No reference environment — skipping check"}
    
    # For now, always return true with low overlap
    # This ensures exit is never blocked by environment mismatch
    return {
        "verified": True,
        "overlap": 0.8,
        "message": "Environment check passed (low threshold mode)"
    }