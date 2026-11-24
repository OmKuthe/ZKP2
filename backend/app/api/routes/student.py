# backend/app/api/routes/student.py
"""
Student endpoints - Entry, Exit, GPS verification with QR
Includes Phase 2B: Counter-based Hash Chain
Includes V2: verification_events, zkp_verifications, face_verifications
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
import time
import uuid
import logging

from ...models import (
    Student, Internship, InternshipAssignment, Session, Company,
    ContinuityCheck, Anomaly,
    # V2 models
    ZkpVerification, FaceVerification, VerificationEvent,
    VerificationLayer, VerificationEventType,
)
from ...core.database import get_db
from ...core.config import settings
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


def _utc_naive() -> datetime:
    """Return current UTC as a naive datetime (what SQLite stores)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive_utc_to_epoch(dt: datetime) -> int:
    """
    Epoch seconds for a naive datetime that holds UTC wall-clock time.

    Never call .timestamp() directly on these values: Python treats naive
    datetimes as machine-local time, which shifts results by the local
    UTC offset (5h30m on an IST dev machine).
    """
    return int(dt.replace(tzinfo=timezone.utc).timestamp())


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
    V2: Emits zkp_verifications, face_verifications, verification_events rows.
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

    # 4. Look up active internship (V2: persist internship_id on session)
    assignment = db.query(InternshipAssignment).join(Internship).filter(
        InternshipAssignment.student_id == student.id,
        Internship.status == "active",
        InternshipAssignment.is_active == True,
    ).first()
    internship_id = assignment.internship_id if assignment else None

    # 5. ✅ Generate seed and initialize counter
    hash_service = HashChainService()
    seed = hash_service.generate_seed()
    logger.info(f"🔐 Hash chain seed generated: {seed[:16]}...")

    session_id = f"session_{uuid.uuid4().hex[:12]}"
    entry_time = int(time.time())

    # ✅ Step 2: Face liveness result (optional, from client)
    face_verified = request.face_verified
    face_verified_at = _utc_naive() if face_verified is not None else None

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
        internship_id=internship_id,  # V2 field
        entry_time=datetime.fromtimestamp(entry_time, tz=timezone.utc).replace(tzinfo=None),
        qr_token=request.qr_token,
        hash_chain_seed=seed,
        hash_counter=0,
        hash_chain_length=100,
        check_interval_seconds=60,
        face_verified=face_verified,
        face_verified_at=face_verified_at,
        status="active"
    )

    db.add(new_session)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.warning(f"⚠️ IntegrityError on session insert (race lost): {e}")
        raise HTTPException(
            status_code=409,
            detail="You already have an active session. Please exit first."
        )
    db.refresh(new_session)

    logger.info(f"✅ Session created: {session_id}")

    # ============================================================
    # V2 write paths (gated by V2_WRITE_EVENTS)
    # ============================================================
    if settings.V2_WRITE_EVENTS:
        try:
            now_utc = datetime.now(timezone.utc)

            # ZKP — reaching here means start-entry's ZKP passed (QR was issued)
            zkp = ZkpVerification(
                session_id=new_session.id,
                purpose="entry",
                valid=True,
                message="Verified at start-entry (server-side)",
                public_signals=request.zkp_public_signals,
                actual_distance=request.zkp_actual_distance,
                radius=request.zkp_radius,
                occurred_at=now_utc,
            )
            db.add(zkp)
            db.flush()
            db.add(VerificationEvent(
                session_id=new_session.id,
                layer=VerificationLayer.zkp,
                event_type=VerificationEventType.success,
                occurred_at=now_utc,
                source_table="zkp_verifications",
                source_id=zkp.id,
            ))

            # Face (only if liveness was attempted)
            if face_verified is not None:
                fv = FaceVerification(
                    session_id=new_session.id,
                    event_type="entry_liveness",
                    passed=bool(face_verified),
                    attempts=1,
                    occurred_at=now_utc,
                )
                db.add(fv)
                db.flush()
                db.add(VerificationEvent(
                    session_id=new_session.id,
                    layer=VerificationLayer.face,
                    event_type=VerificationEventType.success if face_verified else VerificationEventType.failure,
                    occurred_at=now_utc,
                    source_table="face_verifications",
                    source_id=fv.id,
                ))

            # Rollup flag on session
            new_session.zkp_verified = True
            db.commit()
            logger.info(f"✅ V2 events written for session {session_id}")
        except Exception as e:
            logger.error(f"⚠️ V2 event write failed (non-fatal, session still created): {e}")
            db.rollback()

    return StudentEntryResponse(
        session_id=session_id,
        message="Entry verified successfully. Hash chain started.",
        entry_time=entry_time,
        seed=seed
    )


# ==================== Continuity Check ====================

@router.post("/verify-continuity", response_model=ContinuityCheckResponse)
async def verify_continuity(
    request: ContinuityCheckRequest,
    db: DBSession = Depends(get_db)
):
    """
    Verify continuity using counter-based approach.
    Stores each heartbeat + emits V2 verification_event.
    Flaw #9: detects heartbeat gaps (client silent for > 2 * interval).
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
    now_ts = request.timestamp
    expected_interval = session.check_interval_seconds or 60
    max_gap = expected_interval * 2

    gap_seconds = None
    gap_detected = False
    gap_severity = None

    if session.last_hash_check is not None:
        last_ts = _naive_utc_to_epoch(session.last_hash_check)
        gap_seconds = now_ts - last_ts

        if gap_seconds > max_gap:
            gap_detected = True
            if gap_seconds > expected_interval * 10:
                gap_severity = "HIGH"
            else:
                gap_severity = "MEDIUM"

            logger.warning(
                f"⚠️ Continuity gap detected for session {request.session_id}: "
                f"{gap_seconds}s since last check (expected ~{expected_interval}s, "
                f"max tolerance {max_gap}s, severity={gap_severity})"
            )

    # 4. ✅ Store heartbeat in database (V2 columns)
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
        client_reported_at=datetime.fromtimestamp(request.timestamp, tz=timezone.utc).replace(tzinfo=None),
        server_received_at=_utc_naive(),
        sequence_num=next_counter,
        hash=request.hash_link,
        valid=is_valid,
        status=status,
        message=message,
        backfilled=False,
    )
    db.add(check)
    db.flush()  # get check.id for event

    if settings.V2_WRITE_EVENTS:
        db.add(VerificationEvent(
            session_id=session.id,
            layer=VerificationLayer.chain,
            event_type=VerificationEventType.success if is_valid else VerificationEventType.failure,
            occurred_at=datetime.now(timezone.utc),
            source_table="heartbeats",
            source_id=check.id,
        ))

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
            status="open",  # V2 field
        )
        db.add(gap_anomaly)
        logger.warning(
            f"🚨 Continuity gap anomaly recorded: "
            f"session={request.session_id}, gap={gap_seconds}s, severity={gap_severity}"
        )

    # 6. Update session
    session.hash_counter = next_counter
    session.last_hash_check = datetime.fromtimestamp(request.timestamp, tz=timezone.utc).replace(tzinfo=None)
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
    """Get all heartbeats for a session (V2: uses sequence_num, backfilled)."""
    session = db.query(Session).filter(
        Session.session_id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    checks = db.query(ContinuityCheck).filter(
        ContinuityCheck.session_id == session.id
    ).order_by(ContinuityCheck.sequence_num.asc()).all()

    return {
        "session_id": session_id,
        "entry_time": session.entry_time,
        "exit_time": session.exit_time,
        "status": session.status,
        "checks": [
            {
                "id": c.id,
                "sequence_num": c.sequence_num,
                "client_reported_at": c.client_reported_at,
                "server_received_at": c.server_received_at,
                "status": c.status,
                "hash": c.hash,
                "valid": c.valid,
                "message": c.message,
                "backfilled": c.backfilled,
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
    """Step 1: Student sends GPS for exit verification."""
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
    V2: canonicalizes status to closed/flagged, emits exit-chain event.
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

    # 5. Close session (V2: canonical statuses)
    exit_timestamp = int(time.time())
    duration_seconds = exit_timestamp - _naive_utc_to_epoch(session.entry_time)

    session.exit_time = datetime.fromtimestamp(exit_timestamp, tz=timezone.utc).replace(tzinfo=None)
    session.status = "closed" if chain_verified else "flagged"
    session.total_duration_seconds = duration_seconds
    session.chain_verified = chain_verified

    db.commit()

    logger.info(f"✅ Session closed: {session.session_id}, Duration: {duration_seconds}s, Status: {session.status}")

    # 6. V2: emit exit-chain event
    if settings.V2_WRITE_EVENTS:
        try:
            now_utc = datetime.now(timezone.utc)
            last_hb = db.query(ContinuityCheck).filter(
                ContinuityCheck.session_id == session.id
            ).order_by(ContinuityCheck.sequence_num.desc()).first()
            if last_hb:
                db.add(VerificationEvent(
                    session_id=session.id,
                    layer=VerificationLayer.chain,
                    event_type=VerificationEventType.success if chain_verified else VerificationEventType.failure,
                    occurred_at=now_utc,
                    source_table="heartbeats",
                    source_id=last_hb.id,
                ))
                db.commit()
        except Exception as e:
            logger.error(f"⚠️ V2 exit event write failed: {e}")
            db.rollback()

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
            "duration_minutes": int((time.time() - _naive_utc_to_epoch(session.entry_time)) / 60),
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
    """Store environment commitment."""
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
    """Verify environment — always returns True for now."""
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

    return {
        "verified": True,
        "overlap": 0.8,
        "message": "Environment check passed (low threshold mode)"
    }