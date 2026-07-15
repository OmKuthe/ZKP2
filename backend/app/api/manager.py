from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from ..database import get_db
from ..models import Internship, InternshipEnrollment, DailyAttendance, AttendanceProof, User, StudentProfile, Company
from ..utils.helpers import calculate_attendance_hours
from .auth import get_current_user
from datetime import datetime, date, timedelta,time
from typing import Optional
import json
import pytz

router = APIRouter(prefix="/api/manager", tags=["manager"])

# Define IST timezone
IST = pytz.timezone('Asia/Kolkata')

# ========== Helper ==========
async def verify_manager(token: str, db: AsyncSession, manager_id: str = None):
    current_user = get_current_user(token)
    if not current_user or current_user["user_type"] != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if manager_id and current_user["user_id"] != manager_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user

def get_ist_today() -> date:
    """Always return today's date in IST, regardless of server timezone."""
    return datetime.now(IST).date()

# ========== Dashboard ==========
@router.get("/dashboard")
async def get_manager_dashboard(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_manager(token, db)
    
    # Get all internships managed by this manager
    internships_result = await db.execute(
        select(Internship).where(Internship.manager_id == current_user["user_id"])
    )
    internships = internships_result.scalars().all()
    
    dashboard_data = []
    today = get_ist_today()
    
    # Get UTC range for today
    day_start_ist = datetime.combine(today, time.min).replace(tzinfo=IST)
    day_end_ist = datetime.combine(today, time.max).replace(tzinfo=IST)
    day_start_utc = day_start_ist.astimezone(pytz.UTC).replace(tzinfo=None)
    day_end_utc = day_end_ist.astimezone(pytz.UTC).replace(tzinfo=None)

    for internship in internships:
        # Get enrolled students
        enrollments_result = await db.execute(
            select(InternshipEnrollment).where(InternshipEnrollment.internship_id == internship.id)
        )
        enrollments = enrollments_result.scalars().all()
        total_students = len(enrollments)
        
        # Count present students based on having ANY proof today
        present_count = 0
        for enrollment in enrollments:
            proof_count_result = await db.execute(
                select(func.count(AttendanceProof.id)).where(
                    and_(
                        AttendanceProof.internship_id == internship.id,
                        AttendanceProof.student_id == enrollment.student_id,
                        AttendanceProof.timestamp >= day_start_utc,
                        AttendanceProof.timestamp <= day_end_utc
                    )
                )
            )
            if (proof_count_result.scalar() or 0) > 0:
                present_count += 1
        
        # Get company details
        company_result = await db.execute(select(Company).where(Company.id == internship.company_id))
        company = company_result.scalar_one_or_none()
        
        dashboard_data.append({
            "internship_id": internship.internship_id,
            "company_name": company.name if company else "Unknown",
            "role_name": internship.role_name,
            "total_students": total_students,
            "present_today": present_count,
            "absent_today": total_students - present_count,
            "status": internship.status,
            "daily_hours": f"{internship.daily_start_time} - {internship.daily_end_time}"
        })
    
    return {"internships": dashboard_data}


# ========== Internship Details ==========
@router.get("/internship/{internship_id}")
async def get_internship_details(
    internship_id: str,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_manager(token, db)
    
    # Get internship
    internship_result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = internship_result.scalar_one_or_none()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    # Verify manager owns this internship
    if internship.manager_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get company details
    company_result = await db.execute(select(Company).where(Company.id == internship.company_id))
    company = company_result.scalar_one_or_none()
    
    # Get enrolled students with today's attendance
    enrollments_result = await db.execute(
        select(InternshipEnrollment).where(InternshipEnrollment.internship_id == internship.id)
    )
    enrollments = enrollments_result.scalars().all()
    
    students_data = []
    today = get_ist_today()
    
    for enrollment in enrollments:
        # Get student details
        student_result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == enrollment.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        user_result = await db.execute(select(User).where(User.user_id == enrollment.student_id))
        user = user_result.scalar_one_or_none()
        
        # Get today's attendance (using IST date)
        attendance_result = await db.execute(
            select(DailyAttendance).where(
                and_(
                    DailyAttendance.internship_id == internship.id,
                    DailyAttendance.student_id == enrollment.student_id,
                    DailyAttendance.date == today
                )
            )
        )
        attendance = attendance_result.scalar_one_or_none()
        
        # Get latest proof and convert timestamp to IST
        latest_proof_result = await db.execute(
            select(AttendanceProof)
            .where(AttendanceProof.internship_id == internship.id)
            .where(AttendanceProof.student_id == enrollment.student_id)
            .order_by(AttendanceProof.timestamp.desc())
            .limit(1)
        )
        latest_proof = latest_proof_result.scalar_one_or_none()

        # Convert last proof time to IST for frontend display
        last_proof_ist = None
        if latest_proof and latest_proof.timestamp:
            utc_time = latest_proof.timestamp.replace(tzinfo=pytz.UTC)
            last_proof_ist = utc_time.astimezone(IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")

        # Count today's proofs and verified proofs for success rate
        today_proofs_result = await db.execute(
            select(func.count(AttendanceProof.id)).where(
                and_(
                    AttendanceProof.internship_id == internship.id,
                    AttendanceProof.student_id == enrollment.student_id,
                    AttendanceProof.timestamp >= datetime.combine(today, datetime.min.time()),
                    AttendanceProof.timestamp < datetime.combine(today + timedelta(days=1), datetime.min.time())
                )
            )
        )
        today_proof_count = today_proofs_result.scalar() or 0

        today_verified_result = await db.execute(
            select(func.count(AttendanceProof.id)).where(
                and_(
                    AttendanceProof.internship_id == internship.id,
                    AttendanceProof.student_id == enrollment.student_id,
                    AttendanceProof.is_valid == True,
                    AttendanceProof.timestamp >= datetime.combine(today, datetime.min.time()),
                    AttendanceProof.timestamp < datetime.combine(today + timedelta(days=1), datetime.min.time())
                )
            )
        )
        today_verified_count = today_verified_result.scalar() or 0
        
        today_status = "absent"
        if today_proof_count > 0:
            today_status = "present"
        # Also keep track of in_progress for live tracking
        if attendance and attendance.status == "in_progress":
            today_status = "in_progress"

        students_data.append({
            "student_id": enrollment.student_id,
            "student_name": user.full_name if user else "Unknown",
            "roll_number": student.roll_number if student else "N/A",
            "today_status": today_status,  # NEW - based on proof count
            "today_hours": float(attendance.total_hours) if attendance else 0,
            "proof_count": today_proof_count,
            "verified_count": today_verified_count,
            "last_proof_time": last_proof_ist,
            "last_location": {"lat": latest_proof.latitude, "lng": latest_proof.longitude} if latest_proof else None
        })
    
    present_statuses = ["full_day", "partial", "in_progress", "present"]
    return {
        "internship": {
            "internship_id": internship.internship_id,
            "company_name": company.name if company else "Unknown",
            "company_location": {"lat": company.latitude, "lng": company.longitude} if company else None,
            "radius": company.radius_meters if company else 200,
            "role_name": internship.role_name,
            "description": internship.description,
            "daily_start_time": str(internship.daily_start_time),
            "daily_end_time": str(internship.daily_end_time),
            "required_hours": internship.required_hours_per_day,
            "status": internship.status
        },
        "students": students_data,
        "total_students": len(students_data),
        "present_count": len([s for s in students_data if s["today_status"] in present_statuses]),
        "absent_count": len([s for s in students_data if s["today_status"] == "absent"])
    }

# ========== Analytics Endpoint ==========
@router.get("/internship/{internship_id}/analytics")
async def get_internship_analytics(
    internship_id: str,
    days: int = 30,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_manager(token, db)
    
    internship_result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = internship_result.scalar_one_or_none()
    if not internship or internship.manager_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    today = get_ist_today()
    period_start = today - timedelta(days=days - 1)

    # Get all enrolled students
    enrollments_result = await db.execute(
        select(InternshipEnrollment).where(InternshipEnrollment.internship_id == internship.id)
    )
    enrollments = enrollments_result.scalars().all()
    total_students = len(enrollments)

    # ── 1. Daily attendance trend (last N days) ──────────────────────────
    trend_data = []
    for i in range(days):
        day = period_start + timedelta(days=i)
        result = await db.execute(
        select(func.count(DailyAttendance.id)).where(
            and_(
                DailyAttendance.internship_id == internship.id,
                DailyAttendance.date == day,
                or_(
                    DailyAttendance.status == "full_day",
                    DailyAttendance.status == "partial",
                    DailyAttendance.status == "in_progress",
                    DailyAttendance.status == "present"
                )
            )
        )
    )
        present = result.scalar() or 0
        trend_data.append({
            "date": day.isoformat(),
            "present": present,
            "absent": total_students - present,
            "rate": round((present / total_students * 100), 1) if total_students > 0 else 0
        })

    # ── 2. Per-student stats over the period ─────────────────────────────
    present_statuses = ["full_day", "partial", "in_progress", "present"]
    student_stats = []
    at_risk_students = []

    for enrollment in enrollments:
        user_result = await db.execute(select(User).where(User.user_id == enrollment.student_id))
        user = user_result.scalar_one_or_none()

        # Total days present in period
        present_result = await db.execute(
            select(func.count(DailyAttendance.id)).where(
                and_(
                    DailyAttendance.internship_id == internship.id,
                    DailyAttendance.student_id == enrollment.student_id,
                    DailyAttendance.date >= period_start,
                    DailyAttendance.date <= today,
                    or_(*[DailyAttendance.status == s for s in present_statuses])
                )
            )
        )
        days_present = present_result.scalar() or 0

        # Total proofs in period
        total_proofs_result = await db.execute(
            select(func.count(AttendanceProof.id)).where(
                and_(
                    AttendanceProof.internship_id == internship.id,
                    AttendanceProof.student_id == enrollment.student_id,
                    AttendanceProof.timestamp >= datetime.combine(period_start, datetime.min.time()),
                    AttendanceProof.timestamp <= datetime.combine(today + timedelta(days=1), datetime.min.time())
                )
            )
        )
        total_proofs = total_proofs_result.scalar() or 0

        # Verified proofs in period
        verified_proofs_result = await db.execute(
            select(func.count(AttendanceProof.id)).where(
                and_(
                    AttendanceProof.internship_id == internship.id,
                    AttendanceProof.student_id == enrollment.student_id,
                    AttendanceProof.is_valid == True,
                    AttendanceProof.timestamp >= datetime.combine(period_start, datetime.min.time()),
                    AttendanceProof.timestamp <= datetime.combine(today + timedelta(days=1), datetime.min.time())
                )
            )
        )
        verified_proofs = verified_proofs_result.scalar() or 0

        # Total hours in period
        hours_result = await db.execute(
            select(func.sum(DailyAttendance.total_hours)).where(
                and_(
                    DailyAttendance.internship_id == internship.id,
                    DailyAttendance.student_id == enrollment.student_id,
                    DailyAttendance.date >= period_start,
                    DailyAttendance.date <= today
                )
            )
        )
        total_hours = float(hours_result.scalar() or 0)

        attendance_pct = round((days_present / days * 100), 1) if days > 0 else 0
        proof_success_rate = round((verified_proofs / total_proofs * 100), 1) if total_proofs > 0 else 0
        name = user.full_name if user else enrollment.student_id

        stat = {
            "student_id": enrollment.student_id,
            "student_name": name,
            "days_present": days_present,
            "attendance_pct": attendance_pct,
            "total_proofs": total_proofs,
            "verified_proofs": verified_proofs,
            "proof_success_rate": proof_success_rate,
            "total_hours": round(total_hours, 1),
            "is_at_risk": attendance_pct < 75
        }
        student_stats.append(stat)
        if attendance_pct < 75:
            at_risk_students.append({"student_id": enrollment.student_id, "name": name, "attendance_pct": attendance_pct})

    # ── 3. Overall summary stats ─────────────────────────────────────────
    total_attendance_records = await db.execute(
        select(func.count(DailyAttendance.id)).where(
            and_(
                DailyAttendance.internship_id == internship.id,
                DailyAttendance.date >= period_start,
                DailyAttendance.date <= today,
                or_(
                    DailyAttendance.status == "full_day",
                    DailyAttendance.status == "partial",
                    DailyAttendance.status == "in_progress",
                    DailyAttendance.status == "present"
                )
            )
        )
    )
    total_present_days = total_attendance_records.scalar() or 0
    possible_days = total_students * days
    overall_rate = round((total_present_days / possible_days * 100), 1) if possible_days > 0 else 0

    # ── 4. Proof distribution by hour (IST) ─────────────────────────────
    proofs_result = await db.execute(
        select(AttendanceProof).where(
            and_(
                AttendanceProof.internship_id == internship.id,
                AttendanceProof.timestamp >= datetime.combine(period_start, datetime.min.time()),
                AttendanceProof.timestamp <= datetime.combine(today + timedelta(days=1), datetime.min.time())
            )
        )
    )
    all_proofs = proofs_result.scalars().all()

    hour_distribution = {h: 0 for h in range(24)}
    for p in all_proofs:
        utc_time = p.timestamp.replace(tzinfo=pytz.UTC)
        ist_hour = utc_time.astimezone(IST).hour
        hour_distribution[ist_hour] += 1

    hourly_data = [{"hour": f"{h:02d}:00", "count": hour_distribution[h]} for h in range(24)]

    return {
        "period_days": days,
        "period_start": period_start.isoformat(),
        "period_end": today.isoformat(),
        "total_students": total_students,
        "overall_attendance_rate": overall_rate,
        "at_risk_count": len(at_risk_students),
        "at_risk_students": at_risk_students,
        "daily_trend": trend_data,
        "student_stats": student_stats,
        "hourly_distribution": hourly_data
    }

# ========== NEW: Individual Student Calendar Endpoint ==========
@router.get("/student/{student_id}/calendar")
async def get_student_calendar(
    student_id: str,
    internship_id: str,
    year: int,
    month: int,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_manager(token, db)
    
    # Verify internship belongs to manager
    internship_result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = internship_result.scalar_one_or_none()
    if not internship or internship.manager_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get attendance for the specified month
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    
    result = await db.execute(
        select(DailyAttendance).where(
            and_(
                DailyAttendance.internship_id == internship.id,
                DailyAttendance.student_id == student_id,
                DailyAttendance.date >= start_date,
                DailyAttendance.date < end_date
            )
        )
    )
    attendances = result.scalars().all()
    
    calendar_data = {}
    for att in attendances:
        calendar_data[att.date.isoformat()] = {
            "hours": att.total_hours,
            "status": att.status,
            "proof_count": att.proof_count
        }
    
    # Get student name
    user_result = await db.execute(select(User).where(User.user_id == student_id))
    user = user_result.scalar_one_or_none()
    
    return {
        "student_id": student_id,
        "student_name": user.full_name if user else student_id,
        "year": year,
        "month": month,
        "attendance": calendar_data
    }

# ========== Student Timeline ==========
@router.get("/student/{student_id}/timeline")
async def get_student_timeline(
    student_id: str,
    internship_id: str,
    date_param: Optional[str] = None,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_manager(token, db)
    
    # Get internship
    internship_result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = internship_result.scalar_one_or_none()
    if not internship or internship.manager_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Use IST today if no date provided
    target_date = datetime.strptime(date_param, "%Y-%m-%d").date() if date_param else get_ist_today()

    # Query proofs using a UTC range that covers the full IST day
    target_start_ist = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=IST)
    target_end_ist = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=IST)
    target_start_utc = target_start_ist.astimezone(pytz.UTC).replace(tzinfo=None)
    target_end_utc = target_end_ist.astimezone(pytz.UTC).replace(tzinfo=None)

    proofs_result = await db.execute(
        select(AttendanceProof)
        .where(AttendanceProof.internship_id == internship.id)
        .where(AttendanceProof.student_id == student_id)
        .where(AttendanceProof.timestamp >= target_start_utc)
        .where(AttendanceProof.timestamp <= target_end_utc)
        .order_by(AttendanceProof.timestamp)
    )
    proofs = proofs_result.scalars().all()
    
    # Get daily summary
    attendance_result = await db.execute(
        select(DailyAttendance)
        .where(DailyAttendance.internship_id == internship.id)
        .where(DailyAttendance.student_id == student_id)
        .where(DailyAttendance.date == target_date)
    )
    attendance = attendance_result.scalar_one_or_none()

    verified_count = sum(1 for p in proofs if p.is_valid)
    total_count = len(proofs)

    return {
        "date": target_date.isoformat(),
        "total_hours": float(attendance.total_hours) if attendance else 0,
        "status": attendance.status if attendance else "absent",
        "proof_count": total_count,
        "verified_count": verified_count,
        "proof_success_rate": round((verified_count / total_count * 100), 1) if total_count > 0 else 0,
        "proofs": [
            {
                "time": p.timestamp.replace(tzinfo=pytz.UTC).astimezone(IST).strftime("%H:%M:%S"),
                "type": p.proof_type,
                "verified": p.is_valid,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "distance": round(p.distance_from_company, 1) if p.distance_from_company else None
            } for p in proofs
        ]
    }

# ========== Export Report ==========
@router.get("/internship/{internship_id}/export")
async def export_attendance_report(
    internship_id: str,
    start_date: str,
    end_date: str,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_manager(token, db)
    
    # Get internship
    internship_result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = internship_result.scalar_one_or_none()
    if not internship or internship.manager_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    # Get all attendance records in date range
    attendance_result = await db.execute(
        select(DailyAttendance)
        .where(DailyAttendance.internship_id == internship.id)
        .where(DailyAttendance.date >= start)
        .where(DailyAttendance.date <= end)
        .order_by(DailyAttendance.date, DailyAttendance.student_id)
    )
    attendance_records = attendance_result.scalars().all()
    
    # Group by student
    report_data = {}
    for record in attendance_records:
        if record.student_id not in report_data:
            report_data[record.student_id] = []
        report_data[record.student_id].append({
            "date": record.date.isoformat(),
            "hours": float(record.total_hours),
            "status": record.status,
            "proof_count": record.proof_count
        })
    
    # Get student names
    students_info = {}
    for student_id in report_data.keys():
        user_result = await db.execute(select(User).where(User.user_id == student_id))
        user = user_result.scalar_one_or_none()
        students_info[student_id] = user.full_name if user else student_id
    
    return {
        "internship_id": internship_id,
        "period": {"start": start_date, "end": end_date},
        "students": [
            {
                "student_id": student_id,
                "name": students_info[student_id],
                "attendance": records
            } for student_id, records in report_data.items()
        ]
    }