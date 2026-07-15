from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from ..database import get_db
from ..models import (
    Internship, InternshipEnrollment, DailyAttendance, AttendanceProof, 
    Company, StudentProfile
)
from ..schemas import AttendanceSubmit, AttendanceResponse
from ..utils.helpers import calculate_distance, hash_student_id
from .auth import get_current_user
from datetime import datetime, date, time, timedelta
from typing import Optional
import json
import pytz

router = APIRouter(prefix="/api/student", tags=["student"])

IST = pytz.timezone('Asia/Kolkata')

def get_ist_today() -> date:
    return datetime.now(IST).date()


def compute_attendance_status(
    periodic_proof_count: int,
    internship_duration_minutes: int,
    proof_interval_minutes: int
) -> str:
    """
    Attendance status based purely on periodic proof count.
    Entry and exit proofs are excluded — only 'hourly' (periodic) proofs count.

    Formula:
      expected = duration_minutes / interval_minutes
      >= 80% of expected  →  full_day
      >= 50% of expected  →  partial
      <  50% of expected  →  absent

    Examples:
      10-min session, 1-min interval → expected=10; full>=8, partial>=5
      10-min session, 2-min interval → expected=5;  full>=4, partial>=3
      60-min session, 5-min interval → expected=12; full>=10, partial>=6
    """
    interval = max(1, proof_interval_minutes)
    expected = max(1, internship_duration_minutes // interval)
    pct = (periodic_proof_count / expected) * 100

    if pct >= 80:
        return "full_day"
    elif pct >= 50:
        return "partial"
    else:
        return "absent"


async def verify_student(token: str, db: AsyncSession, student_id: str = None):
    current_user = get_current_user(token)
    if not current_user or current_user["user_type"] != "student":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if student_id and current_user["user_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user


# ── Dashboard ─────────────────────────────────────────────────────────────────
@router.get("/dashboard")
async def get_student_dashboard(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user["user_id"])
    )
    profile = profile_result.scalar_one_or_none()
    
    now_utc = datetime.now(pytz.UTC)
    now_ist = now_utc.astimezone(IST)
    current_time = now_ist.time()
    today = now_ist.date()
    
    active_internship = None
    
    if profile and profile.current_internship_id:
        internship_result = await db.execute(
            select(Internship).where(Internship.id == profile.current_internship_id)
        )
        internship = internship_result.scalar_one_or_none()
        
        if internship and internship.start_date <= today <= internship.end_date:
            company_result = await db.execute(select(Company).where(Company.id == internship.company_id))
            company = company_result.scalar_one_or_none()
            
            attendance_result = await db.execute(
                select(DailyAttendance).where(
                    and_(
                        DailyAttendance.internship_id == internship.id,
                        DailyAttendance.student_id == current_user["user_id"],
                        DailyAttendance.date == today
                    )
                )
            )
            today_attendance = attendance_result.scalar_one_or_none()
            
            can_start = False
            status_message = ""
            if current_time < internship.daily_start_time:
                status_message = f"Session starts at {internship.daily_start_time.strftime('%I:%M %p')}"
            elif current_time > internship.daily_end_time:
                status_message = f"Session ended at {internship.daily_end_time.strftime('%I:%M %p')}"
            else:
                can_start = True
                status_message = "Session active"
            
            start_minutes = internship.daily_start_time.hour * 60 + internship.daily_start_time.minute
            end_minutes   = internship.daily_end_time.hour * 60 + internship.daily_end_time.minute
            total_minutes = end_minutes - start_minutes
            
            elapsed_minutes = 0
            if today_attendance and today_attendance.first_proof_time:
                first_proof_utc = today_attendance.first_proof_time.replace(tzinfo=pytz.UTC)
                elapsed_seconds = (now_utc - first_proof_utc).total_seconds()
                elapsed_minutes = min(int(elapsed_seconds / 60), total_minutes)
            
            active_internship = {
                "internship_id": internship.internship_id,
                "company_name": company.name if company else "Unknown",
                "role_name": internship.role_name,
                "daily_start": internship.daily_start_time.strftime("%H:%M"),
                "daily_end": internship.daily_end_time.strftime("%H:%M"),
                "total_minutes": total_minutes,
                "elapsed_minutes": elapsed_minutes,
                "can_start": can_start,
                "status_message": status_message,
                "company_location": {"lat": company.latitude, "lng": company.longitude} if company else None,
                "radius": company.radius_meters if company else 200,
                "is_test_mode": bool(internship.is_test_mode),
                "proof_interval_minutes": internship.proof_interval_minutes,
                "company_address": company.address if company else "Address not available",
            }
    
    return {
        "student": {
            "student_id": current_user["user_id"],
            "full_name": current_user["full_name"]
        },
        "active_internship": active_internship,
        "server_time": now_ist.strftime("%Y-%m-%d %H:%M:%S")
    }


# ── Calendar ──────────────────────────────────────────────────────────────────
@router.get("/attendance/calendar")
async def get_attendance_calendar(
    year: int,
    month: int,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    
    start_date = date(year, month, 1)
    end_date   = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user["user_id"])
    )
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.current_internship_id:
        return {"attendance": {}}
    
    result = await db.execute(
        select(DailyAttendance).where(
            and_(
                DailyAttendance.student_id == current_user["user_id"],
                DailyAttendance.date >= start_date,
                DailyAttendance.date < end_date
            )
        )
    )
    attendances = result.scalars().all()
    
    calendar_data = {}
    for att in attendances:
        calendar_data[att.date.isoformat()] = {
            "hours": float(att.total_hours or 0),
            "status": att.status,
            "proof_count": att.proof_count or 0
        }
    
    return {"year": year, "month": month, "attendance": calendar_data}


# ── Attendance status ─────────────────────────────────────────────────────────
@router.get("/attendance/status")
async def get_attendance_status(
    date_param: str,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    
    target_date = datetime.strptime(date_param, "%Y-%m-%d").date()
    
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == current_user["user_id"])
    )
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.current_internship_id:
        return {"status": "no_internship", "total_hours": 0}
    
    attendance_result = await db.execute(
        select(DailyAttendance).where(
            and_(
                DailyAttendance.student_id == current_user["user_id"],
                DailyAttendance.date == target_date
            )
        )
    )
    attendance = attendance_result.scalar_one_or_none()
    if not attendance:
        return {"status": "absent", "total_hours": 0}
    
    return {
        "status": attendance.status,
        "total_hours": float(attendance.total_hours or 0),
        "proof_count": attendance.proof_count or 0
    }


# ── Submit proof ──────────────────────────────────────────────────────────────
@router.post("/attendance/submit", response_model=AttendanceResponse)
async def submit_attendance_proof(
    proof: AttendanceSubmit,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db, proof.student_id)
    
    try:
        internship_result = await db.execute(
            select(Internship).where(Internship.internship_id == proof.internship_id)
        )
        internship = internship_result.scalar_one_or_none()
        if not internship:
            raise HTTPException(status_code=404, detail="Internship not found")
        
        enrollment_result = await db.execute(
            select(InternshipEnrollment).where(
                and_(
                    InternshipEnrollment.internship_id == internship.id,
                    InternshipEnrollment.student_id == proof.student_id,
                    InternshipEnrollment.status == "active"
                )
            )
        )
        if not enrollment_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not enrolled in this internship")
        
        company_result = await db.execute(select(Company).where(Company.id == internship.company_id))
        company = company_result.scalar_one_or_none()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        distance = calculate_distance(
            proof.latitude, proof.longitude,
            company.latitude, company.longitude
        )
        is_valid = distance <= company.radius_meters

        # IST date — avoids filing under wrong date for post-midnight UTC submissions
        today = get_ist_today()

        # Get or create daily attendance record
        attendance_result = await db.execute(
            select(DailyAttendance).where(
                and_(
                    DailyAttendance.internship_id == internship.id,
                    DailyAttendance.student_id == proof.student_id,
                    DailyAttendance.date == today
                )
            )
        )
        daily_attendance = attendance_result.scalar_one_or_none()
        
        if not daily_attendance:
            daily_attendance = DailyAttendance(
                internship_id=internship.id,
                student_id=proof.student_id,
                date=today,
                status="in_progress",
                proof_count=0
            )
            db.add(daily_attendance)
            await db.flush()
        
        proof_time = datetime.now(pytz.UTC).replace(tzinfo=None)

        if proof.proof_type == "entry" or not daily_attendance.first_proof_time:
            daily_attendance.first_proof_time = proof_time
        daily_attendance.last_proof_time = proof_time
        daily_attendance.proof_count = (daily_attendance.proof_count or 0) + 1

        # Save proof record
        new_proof = AttendanceProof(
            attendance_id=daily_attendance.id,
            student_id=proof.student_id,
            internship_id=internship.id,
            timestamp=proof_time,
            latitude=proof.latitude,
            longitude=proof.longitude,
            distance_from_company=distance,
            zk_proof=json.dumps(proof.zk_proof) if proof.zk_proof else "{}",
            public_signals=json.dumps(proof.public_signals) if proof.public_signals else "[]",
            proof_type=proof.proof_type,
            is_valid=is_valid,
            verified_at=proof_time if is_valid else None
        )
        db.add(new_proof)

        # ── Recompute status on every submission ──────────────────────────────
        # Count periodic proofs already saved (the new one isn't committed yet)
        periodic_saved_result = await db.execute(
            select(func.count(AttendanceProof.id)).where(
                and_(
                    AttendanceProof.attendance_id == daily_attendance.id,
                    AttendanceProof.proof_type == "hourly"
                )
            )
        )
        periodic_saved = periodic_saved_result.scalar() or 0
        # Add 1 if current proof is also periodic
        periodic_count = periodic_saved + (1 if proof.proof_type == "hourly" else 0)

        internship_duration_minutes = (
            internship.daily_end_time.hour * 60 + internship.daily_end_time.minute
        ) - (
            internship.daily_start_time.hour * 60 + internship.daily_start_time.minute
        )

        # Update hours (always, not just on exit)
        if daily_attendance.first_proof_time:
            raw_minutes = (proof_time - daily_attendance.first_proof_time).total_seconds() / 60
            # Only deduct lunch break if session lasted longer than the break itself
            if raw_minutes > (internship.lunch_break_minutes or 0):
                raw_minutes -= (internship.lunch_break_minutes or 0)
            daily_attendance.total_minutes = int(raw_minutes)
            daily_attendance.total_hours   = round(raw_minutes / 60, 2)

        if proof.proof_type == "exit":
            # Finalise: compute status from periodic proof count
            final_status = compute_attendance_status(
                periodic_count,
                internship_duration_minutes,
                internship.proof_interval_minutes or 1
            )
            daily_attendance.status = final_status

            # Update student cumulative stats
            if final_status in ["full_day", "partial"]:
                student_result = await db.execute(
                    select(StudentProfile).where(StudentProfile.student_id == proof.student_id)
                )
                student = student_result.scalar_one_or_none()
                if student:
                    student.total_hours_completed = (student.total_hours_completed or 0) + daily_attendance.total_hours
                    if final_status == "full_day":
                        student.total_days_present = (student.total_days_present or 0) + 1
        else:
            # Keep in_progress until exit — manager sees them as actively present
            daily_attendance.status = "in_progress"

        await db.commit()
        
        return AttendanceResponse(
            status="success",
            verified=is_valid,
            message=f"{proof.proof_type.capitalize()} proof recorded. "
                    f"Periodic proofs: {periodic_count}",
            proof_id=new_proof.id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in submit_attendance_proof: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ── Today's proofs ────────────────────────────────────────────────────────────
@router.get("/attendance/today")
async def get_today_attendance(
    internship_id: Optional[str] = None,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    
    now_ist         = datetime.now(IST)
    today_ist       = now_ist.date()
    today_start_ist = datetime.combine(today_ist, time.min).replace(tzinfo=IST)
    today_end_ist   = datetime.combine(today_ist, time.max).replace(tzinfo=IST)
    today_start_utc = today_start_ist.astimezone(pytz.UTC).replace(tzinfo=None)
    today_end_utc   = today_end_ist.astimezone(pytz.UTC).replace(tzinfo=None)
    
    query = select(AttendanceProof).where(
        and_(
            AttendanceProof.student_id == current_user["user_id"],
            AttendanceProof.timestamp >= today_start_utc,
            AttendanceProof.timestamp <= today_end_utc
        )
    )
    
    if internship_id:
        internship_result = await db.execute(
            select(Internship).where(Internship.internship_id == internship_id)
        )
        internship = internship_result.scalar_one_or_none()
        if internship:
            query = query.where(AttendanceProof.internship_id == internship.id)
    
    query  = query.order_by(AttendanceProof.timestamp)
    result = await db.execute(query)
    proofs = result.scalars().all()
    
    proofs_data = []
    for p in proofs:
        utc_time = p.timestamp.replace(tzinfo=pytz.UTC)
        ist_time = utc_time.astimezone(IST)
        proofs_data.append({
            "time":     ist_time.strftime("%H:%M:%S"),
            "type":     p.proof_type,
            "verified": p.is_valid,
            "distance": round(p.distance_from_company, 2) if p.distance_from_company else None
        })
    
    return {
        "date":   today_ist.isoformat(),
        "proofs": proofs_data,
        "count":  len(proofs_data)
    }


# ── History ───────────────────────────────────────────────────────────────────
@router.get("/attendance/history")
async def get_attendance_history(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
    limit: int = 30,
    offset: int = 0
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    
    result = await db.execute(
        select(DailyAttendance)
        .where(DailyAttendance.student_id == current_user["user_id"])
        .order_by(DailyAttendance.date.desc())
        .offset(offset)
        .limit(limit)
    )
    attendance_records = result.scalars().all()
    
    history = []
    for record in attendance_records:
        internship_result = await db.execute(
            select(Internship).where(Internship.id == record.internship_id)
        )
        internship = internship_result.scalar_one_or_none()
        company_result = await db.execute(
            select(Company).where(Company.id == internship.company_id)
        ) if internship else None
        company = company_result.scalar_one_or_none() if company_result else None
        
        history.append({
            "date":        record.date.isoformat(),
            "company":     company.name if company else "Unknown",
            "role":        internship.role_name if internship else "Unknown",
            "hours":       float(record.total_hours or 0),
            "status":      record.status,
            "proof_count": record.proof_count or 0
        })
    
    return {"history": history, "total": len(history)}