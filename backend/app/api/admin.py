from fastapi import APIRouter, Depends, HTTPException, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete, update
from sqlalchemy.orm import selectinload
from ..database import get_db
from ..models import (
    User, StudentProfile, ManagerProfile, Company, Internship, 
    InternshipEnrollment, DailyAttendance, AttendanceProof,Holiday 
)
from ..schemas import (
    StudentCreate, ManagerCreate, CompanyCreate, InternshipCreate
)
from ..utils.helpers import generate_internship_id
from datetime import datetime, date, timedelta
from passlib.context import CryptContext
from typing import Optional, List
import json
import pandas as pd
import io
from fastapi import UploadFile, File
from fastapi import Query


router = APIRouter(prefix="/api/admin", tags=["admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ADMIN_TOKEN = "admin_secret_key_2026"



def should_be_active(internship) -> bool:
    """Check if internship should be active based on current date"""
    today = date.today()
    return internship.start_date <= today <= internship.end_date

async def verify_admin(admin_token: str):
    if admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return True

async def create_user_account(db: AsyncSession, user_id: str, email: str, full_name: str, user_type: str, password: str = None):
    hashed_password = pwd_context.hash(password) if password else ""
    user = User(
        user_id=user_id,
        email=email,
        full_name=full_name,
        user_type=user_type,
        hashed_password=hashed_password,
        is_active=True
    )
    db.add(user)
    await db.flush()
    return user

# ========== Student Management ==========
@router.post("/students/create")
async def create_student(
    student: StudentCreate,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    existing = await db.execute(select(User).where(User.user_id == student.student_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student ID already exists")
    
    user = await create_user_account(
        db, student.student_id, student.email, student.full_name, 
        "student", student.password
    )
    
    student_profile = StudentProfile(
        student_id=student.student_id,
        roll_number=student.roll_number,
        course=student.course,
        year=student.year,
        semester=student.semester,
        phone_number=student.phone_number
    )
    db.add(student_profile)
    await db.commit()
    
    return {"message": f"Student {student.student_id} created successfully"}

@router.post("/students/bulk-upload")
async def bulk_upload_students(
    file: UploadFile = File(...),
    admin_token: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """Bulk upload students from Excel/CSV file"""
    
    # Read the file
    contents = await file.read()
    
    # Determine file type and read accordingly
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    else:  # Assume Excel
        df = pd.read_excel(io.BytesIO(contents))
    
    # Expected columns (matching your existing StudentCreate schema)
    required_columns = ['student_id', 'email', 'full_name', 'roll_number', 
                        'course', 'year', 'semester', 'phone_number', 'department']
    
    # Validate columns
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_cols}")
    
    created_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            student_id = str(row['student_id']).strip()
            
            # Check if student already exists
            existing = await db.execute(
                select(User).where(User.user_id == student_id)
            )
            if existing.scalar_one_or_none():
                errors.append(f"Row {idx+2}: Student ID {student_id} already exists")
                continue
            
            # Create user account (optional password can be empty)
            user = User(
                user_id=student_id,
                email=str(row['email']),
                full_name=str(row['full_name']),
                user_type="student",
                department=str(row.get('department', '')),
                hashed_password="",  # No password for students
                is_active=True
            )
            db.add(user)
            await db.flush()
            
            # Create student profile
            student_profile = StudentProfile(
                student_id=student_id,
                roll_number=str(row['roll_number']),
                course=str(row['course']),
                year=int(row['year']),
                semester=int(row['semester']),
                phone_number=str(row['phone_number'])
            )
            db.add(student_profile)
            created_count += 1
            
        except Exception as e:
            errors.append(f"Row {idx+2}: {str(e)}")
    
    await db.commit()
    
    return {
        "message": f"Successfully created {created_count} students",
        "created": created_count,
        "errors": errors
    }

@router.get("/students/list")
async def list_students(
    admin_token: str,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    await verify_admin(admin_token)
    
    result = await db.execute(select(StudentProfile).offset(skip).limit(limit))
    students = result.scalars().all()
    
    student_list = []
    for student in students:
        user_result = await db.execute(select(User).where(User.user_id == student.student_id))
        user = user_result.scalar_one_or_none()
        
        student_list.append({
            "student_id": student.student_id,
            "email": user.email if user else "",
            "full_name": user.full_name if user else "",
            "roll_number": student.roll_number,
            "course": student.course,
            "year": student.year,
            "semester": student.semester,
            "phone_number": student.phone_number
        })
    
    return {"students": student_list, "total": len(student_list)}

@router.delete("/students/{student_id}")
async def delete_student(
    student_id: str,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    user_result = await db.execute(select(User).where(User.user_id == student_id))
    user = user_result.scalar_one_or_none()
    if user:
        profile_result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
        profile = profile_result.scalar_one_or_none()
        if profile:
            await db.delete(profile)
        await db.delete(user)
        await db.commit()
    
    return {"message": f"Student {student_id} deleted"}

# ========== Manager Management ==========
@router.post("/managers/create")
async def create_manager(
    manager: ManagerCreate,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    existing = await db.execute(select(User).where(User.user_id == manager.manager_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Manager ID already exists")
    
    user = await create_user_account(
        db, manager.manager_id, manager.email, manager.full_name, 
        "manager", manager.password
    )
    
    manager_profile = ManagerProfile(
        manager_id=manager.manager_id,
        designation=manager.designation,
        phone_number=manager.phone_number,
        department=manager.department
    )
    db.add(manager_profile)
    await db.commit()
    
    return {"message": f"Manager {manager.manager_id} created successfully"}

@router.get("/managers/list")
async def list_managers(
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    result = await db.execute(select(ManagerProfile))
    managers = result.scalars().all()
    
    manager_list = []
    for manager in managers:
        user_result = await db.execute(select(User).where(User.user_id == manager.manager_id))
        user = user_result.scalar_one_or_none()
        
        manager_list.append({
            "manager_id": manager.manager_id,
            "email": user.email if user else "",
            "full_name": user.full_name if user else "",
            "designation": manager.designation,
            "department": manager.department,
            "phone_number": manager.phone_number,
            "is_active": user.is_active if user else True
        })
    
    return {"managers": manager_list}

@router.delete("/managers/{manager_id}")
async def delete_manager(
    manager_id: str,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    user_result = await db.execute(select(User).where(User.user_id == manager_id))
    user = user_result.scalar_one_or_none()
    if user:
        profile_result = await db.execute(select(ManagerProfile).where(ManagerProfile.manager_id == manager_id))
        profile = profile_result.scalar_one_or_none()
        if profile:
            await db.delete(profile)
        await db.delete(user)
        await db.commit()
    
    return {"message": f"Manager {manager_id} deleted"}

# ========== Company Management ==========
@router.post("/companies/create")
async def create_company(
    company: CompanyCreate,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    new_company = Company(
        name=company.name,
        address=company.address,
        latitude=company.latitude,
        longitude=company.longitude,
        radius_meters=company.radius_meters,
        created_by="admin"
    )
    db.add(new_company)
    await db.commit()
    await db.refresh(new_company)
    
    return {"message": f"Company {company.name} created", "company_id": new_company.id}

@router.get("/companies/list")
async def list_companies(
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    result = await db.execute(select(Company))
    companies = result.scalars().all()
    
    return {"companies": [{"id": c.id, "name": c.name, "address": c.address, 
                          "latitude": c.latitude, "longitude": c.longitude, 
                          "radius": c.radius_meters} for c in companies]}


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: int,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    # First check if company exists
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check if company has any internships
    internships_result = await db.execute(
        select(Internship).where(Internship.company_id == company_id)
    )
    internships = internships_result.scalars().all()
    
    if internships:
        # Option 1: Prevent deletion if has internships
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete company. It has {len(internships)} internship(s) assigned. Delete internships first."
        )
        # Option 2: Cascade delete (uncomment if you want automatic deletion)
        # for internship in internships:
        #     await db.execute(delete(InternshipEnrollment).where(InternshipEnrollment.internship_id == internship.id))
        #     await db.execute(delete(DailyAttendance).where(DailyAttendance.internship_id == internship.id))
        #     await db.execute(delete(AttendanceProof).where(AttendanceProof.internship_id == internship.id))
        #     await db.delete(internship)
    
    # Delete the company
    await db.delete(company)
    await db.commit()
    
    return {"message": f"Company '{company.name}' deleted successfully"}


# ========== Internship Management ==========

@router.post("/internships/create")
async def create_internship(
    internship_data: dict,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    internship_id = generate_internship_id()
    
    # Calculate duration from start and end time
    start_time = datetime.strptime(internship_data.get("daily_start_time"), "%H:%M").time()
    end_time = datetime.strptime(internship_data.get("daily_end_time"), "%H:%M").time()
    
    # Calculate total minutes
    start_minutes = start_time.hour * 60 + start_time.minute
    end_minutes = end_time.hour * 60 + end_time.minute
    total_minutes = end_minutes - start_minutes
    
    # For demo mode, use the specified interval
    is_test_mode = internship_data.get("is_test_mode", 0)
    proof_interval = internship_data.get("proof_interval_minutes", 60)
    
    # Get stipend information (NEW)
    is_paid = internship_data.get("is_paid", False)
    stipend_amount = internship_data.get("stipend_amount", 0) if is_paid else 0
    
    print(f"Creating internship: {internship_data.get('role_name')}")
    print(f"  Start: {start_time}, End: {end_time}")
    print(f"  Total duration: {total_minutes} minutes")
    print(f"  Test mode: {is_test_mode}, Proof interval: {proof_interval} min")
    print(f"  Paid: {is_paid}, Stipend: {stipend_amount}")
    
    new_internship = Internship(
        internship_id=internship_id,
        company_id=internship_data.get("company_id"),
        role_name=internship_data.get("role_name"),
        description=internship_data.get("description", ""),
        manager_id=internship_data.get("manager_id"),
        start_date=datetime.strptime(internship_data.get("start_date"), "%Y-%m-%d").date(),
        end_date=datetime.strptime(internship_data.get("end_date"), "%Y-%m-%d").date(),
        daily_start_time=start_time,
        daily_end_time=end_time,
        lunch_break_minutes=internship_data.get("lunch_break_minutes", 60),
        required_hours_per_day=round(total_minutes / 60, 2),
        min_hours_for_present=round((total_minutes * 0.8) / 60, 2),
        status="upcoming",
        is_test_mode=is_test_mode,
        test_duration_minutes=total_minutes,
        proof_interval_minutes=proof_interval,
        is_paid=is_paid,  # NEW
        stipend_amount=stipend_amount  # NEW - you need to add this column to Internship model
    )
    db.add(new_internship)
    await db.commit()
    await db.refresh(new_internship)
    
    return {
        "message": "Internship created", 
        "internship_id": internship_id,
        "total_minutes": total_minutes,
        "required_hours": round(total_minutes / 60, 2),
        "proof_interval": proof_interval,
        "is_paid": is_paid,
        "stipend_amount": stipend_amount
    }


@router.post("/internships/{internship_id}/activate")
async def activate_internship(
    internship_id: str,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = result.scalar_one_or_none()
    
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    internship.status = "active"
    await db.commit()
    
    return {"message": f"Internship {internship_id} activated"}


@router.post("/internships/{internship_id}/enroll")
async def enroll_students(
    internship_id: str,
    student_ids: List[str],
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = result.scalar_one_or_none()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    enrolled = []
    failed = []
    
    for student_id in student_ids:
        # Check if student exists
        student_result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id)
        )
        student = student_result.scalar_one_or_none()
        if not student:
            failed.append(f"{student_id} (student not found)")
            continue
        
        # CHECK: Does student already have an active internship?
        # Look for any active enrollment for this student
        existing_enrollment = await db.execute(
            select(InternshipEnrollment).where(
                and_(
                    InternshipEnrollment.student_id == student_id,
                    InternshipEnrollment.status == "active"
                )
            )
        )
        existing = existing_enrollment.scalar_one_or_none()
        
        if existing:
            # Get the internship name for better error message
            existing_internship = await db.execute(
                select(Internship).where(Internship.id == existing.internship_id)
            )
            existing_int = existing_internship.scalar_one_or_none()
            failed.append(f"{student_id} (already has internship: {existing_int.role_name if existing_int else 'Unknown'})")
            continue
        
        # Check if already enrolled in THIS internship
        existing_this = await db.execute(
            select(InternshipEnrollment).where(
                and_(
                    InternshipEnrollment.internship_id == internship.id,
                    InternshipEnrollment.student_id == student_id
                )
            )
        )
        if existing_this.scalar_one_or_none():
            failed.append(f"{student_id} (already enrolled in this internship)")
            continue
        
        # Create enrollment
        enrollment = InternshipEnrollment(
            internship_id=internship.id,
            student_id=student_id,
            status="active"
        )
        db.add(enrollment)
        
        # Update student's current internship
        student.current_internship_id = internship.id
        enrolled.append(student_id)
    
    await db.commit()
    
    return {
        "message": f"Enrolled {len(enrolled)} students",
        "enrolled": enrolled,
        "failed": failed
    }

@router.post("/internships/{internship_id}/bulk-enroll")
async def bulk_enroll_students(
    internship_id: str,
    file: UploadFile = File(...),
    admin_token: str = Query(...),  # Explicitly from query parameter
    db: AsyncSession = Depends(get_db)
):
    # Verify admin token
    if admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    # Read the file
    contents = await file.read()
    
    # Determine file type and read accordingly
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    else:
        df = pd.read_excel(io.BytesIO(contents))
    
    # Expected columns
    if 'student_id' not in df.columns:
        raise HTTPException(status_code=400, detail="File must contain 'student_id' column")
    
    # Get internship
    result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = result.scalar_one_or_none()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    enrolled = []
    failed = []
    
    for idx, row in df.iterrows():
        student_id = str(row['student_id']).strip()
        
        if not student_id or student_id == 'nan':
            failed.append(f"Row {idx+2}: Empty student ID")
            continue
        
        # Check if student exists
        student_result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id)
        )
        student = student_result.scalar_one_or_none()
        if not student:
            failed.append(f"Row {idx+2}: Student '{student_id}' not found")
            continue
        
        # Check if student already has an active internship
        existing_enrollment = await db.execute(
            select(InternshipEnrollment).where(
                and_(
                    InternshipEnrollment.student_id == student_id,
                    InternshipEnrollment.status == "active"
                )
            )
        )
        existing = existing_enrollment.scalar_one_or_none()
        
        if existing:
            existing_internship = await db.execute(
                select(Internship).where(Internship.id == existing.internship_id)
            )
            existing_int = existing_internship.scalar_one_or_none()
            failed.append(f"Row {idx+2}: Student '{student_id}' already has internship: {existing_int.role_name if existing_int else 'Unknown'}")
            continue
        
        # Check if already enrolled in THIS internship
        existing_this = await db.execute(
            select(InternshipEnrollment).where(
                and_(
                    InternshipEnrollment.internship_id == internship.id,
                    InternshipEnrollment.student_id == student_id
                )
            )
        )
        if existing_this.scalar_one_or_none():
            failed.append(f"Row {idx+2}: Student '{student_id}' already enrolled in this internship")
            continue
        
        # Create enrollment
        enrollment = InternshipEnrollment(
            internship_id=internship.id,
            student_id=student_id,
            status="active"
        )
        db.add(enrollment)
        
        # Update student's current internship
        student.current_internship_id = internship.id
        enrolled.append(student_id)
    
    await db.commit()
    
    return {
        "message": f"Successfully enrolled {len(enrolled)} students",
        "enrolled_count": len(enrolled),
        "failed_count": len(failed),
        "failed_details": failed
    }


@router.get("/internships/list")
async def list_internships(
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    result = await db.execute(select(Internship))
    internships = result.scalars().all()
    
    internship_list = []
    today = date.today()
    
    for internship in internships:
        company_result = await db.execute(select(Company).where(Company.id == internship.company_id))
        company = company_result.scalar_one_or_none()
        
        count_result = await db.execute(
            select(func.count(InternshipEnrollment.id)).where(
                InternshipEnrollment.internship_id == internship.id
            )
        )
        enrolled_count = count_result.scalar() or 0
        
        # Auto-activate based on date
        status = internship.status
        if internship.start_date <= today <= internship.end_date:
            status = "active"
        elif today > internship.end_date:
            status = "completed"
        # else status remains "upcoming"
        
        internship_list.append({
            "internship_id": internship.internship_id,
            "company_name": company.name if company else "Unknown",
            "role_name": internship.role_name,
            "manager_id": internship.manager_id,
            "start_date": internship.start_date.isoformat(),
            "end_date": internship.end_date.isoformat(),
            "status": status,  # Use computed status
            "enrolled_students": enrolled_count,
            "daily_hours": f"{internship.daily_start_time} - {internship.daily_end_time}",
            "description": internship.description,
            "is_test_mode": internship.is_test_mode,
            "test_duration_minutes": internship.test_duration_minutes,
            "proof_interval_minutes": internship.proof_interval_minutes,
            "is_paid": getattr(internship, 'is_paid', False),
            "stipend_amount": getattr(internship, 'stipend_amount', 0)
        })
    
    return {"internships": internship_list}


@router.delete("/internships/{internship_id}")
async def delete_internship(
    internship_id: str,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    result = await db.execute(
        select(Internship).where(Internship.internship_id == internship_id)
    )
    internship = result.scalar_one_or_none()
    
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    await db.execute(delete(InternshipEnrollment).where(InternshipEnrollment.internship_id == internship.id))
    await db.execute(delete(DailyAttendance).where(DailyAttendance.internship_id == internship.id))
    await db.execute(delete(AttendanceProof).where(AttendanceProof.internship_id == internship.id))
    await db.execute(update(StudentProfile).where(StudentProfile.current_internship_id == internship.id).values(current_internship_id=None))
    await db.delete(internship)
    await db.commit()
    
    return {"message": f"Internship {internship_id} deleted"}


# ========== Holiday Management ==========
@router.post("/holidays/create")
async def create_holiday(
    holiday_data: dict,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    # Check if holiday already exists on this date
    existing = await db.execute(
        select(Holiday).where(Holiday.date == holiday_data.get("date"))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Holiday already exists on this date")
    
    new_holiday = Holiday(
        date=datetime.strptime(holiday_data.get("date"), "%Y-%m-%d").date(),
        name=holiday_data.get("name"),
        description=holiday_data.get("description"),
        is_global=holiday_data.get("is_global", True),
        company_id=holiday_data.get("company_id"),
        created_by="admin"
    )
    db.add(new_holiday)
    await db.commit()
    await db.refresh(new_holiday)
    
    return {"message": f"Holiday '{holiday_data.get('name')}' created", "holiday_id": new_holiday.id}


@router.get("/holidays/list")
async def list_holidays(
    admin_token: str,
    db: AsyncSession = Depends(get_db),
    year: Optional[int] = None,
    month: Optional[int] = None
):
    await verify_admin(admin_token)
    
    query = select(Holiday).order_by(Holiday.date)
    
    # Filter by year/month if provided
    if year and month:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)
        query = query.where(Holiday.date >= start_date, Holiday.date < end_date)
    
    result = await db.execute(query)
    holidays = result.scalars().all()
    
    holiday_list = []
    for holiday in holidays:
        holiday_list.append({
            "id": holiday.id,
            "date": holiday.date.isoformat(),
            "name": holiday.name,
            "description": holiday.description,
            "is_global": holiday.is_global,
            "company_id": holiday.company_id
        })
    
    return {"holidays": holiday_list, "total": len(holiday_list)}


@router.delete("/holidays/{date}")
async def delete_holiday(
    date: str,
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    # Parse date
    try:
        holiday_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    result = await db.execute(
        select(Holiday).where(Holiday.date == holiday_date)
    )
    holiday = result.scalar_one_or_none()
    
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    await db.delete(holiday)
    await db.commit()
    
    return {"message": f"Holiday '{holiday.name}' deleted successfully"}

@router.get("/dashboard/stats")
async def get_admin_stats(
    admin_token: str,
    db: AsyncSession = Depends(get_db)
):
    await verify_admin(admin_token)
    
    students_count = await db.execute(select(func.count(StudentProfile.id)))
    managers_count = await db.execute(select(func.count(ManagerProfile.id)))
    active_internships = await db.execute(
        select(func.count(Internship.id)).where(Internship.status == "active")
    )
    total_internships = await db.execute(select(func.count(Internship.id)))
    
    today = date.today()
    today_attendance = await db.execute(
        select(func.count(DailyAttendance.id)).where(DailyAttendance.date == today)
    )
    
    return {
        "total_students": students_count.scalar() or 0,
        "total_managers": managers_count.scalar() or 0,
        "active_internships": active_internships.scalar() or 0,
        "total_internships": total_internships.scalar() or 0,
        "today_attendance": today_attendance.scalar() or 0
    }