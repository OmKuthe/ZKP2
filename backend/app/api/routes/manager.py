# backend/app/api/routes/manager.py
"""
Manager Dashboard - View internships and assigned students
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import Optional
import jwt
import os

from ...models import Internship, Company, Student, InternshipAssignment
from ...core.database import get_db

router = APIRouter(prefix="/manager", tags=["manager"])

# ✅ Proper JWT validation
def validate_jwt_token(token: str):
    """Validate JWT token and return user info"""
    try:
        payload = jwt.decode(
            token, 
            os.getenv("JWT_SECRET", "dev-secret"), 
            algorithms=["HS256"]
        )
        return {
            "username": payload.get("username"),
            "role": payload.get("role")
        }
    except jwt.ExpiredSignatureError:
        print("❌ Token expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid token: {e}")
        return None
    except Exception as e:
        print(f"❌ Token validation error: {e}")
        return None


@router.get("/dashboard")
async def get_manager_dashboard(
    authorization: str = Header(None),
    db: DBSession = Depends(get_db)
):
    """Get all internships with summary stats for manager"""
    
    # ✅ Validate token properly
    if not authorization or not authorization.startswith("Bearer "):
        print("❌ No authorization header")
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    print(f"🔍 Token received: {token[:20]}...")
    
    user = validate_jwt_token(token)
    if not user:
        print("❌ Invalid token")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    print(f"✅ User authenticated: {user}")
    
    # Get all internships with student counts
    internships = db.query(Internship).filter(Internship.status == "active").all()
    
    result = []
    for internship in internships:
        # Get company
        company = db.query(Company).filter(Company.id == internship.company_id).first()
        
        # Get student count
        student_count = db.query(InternshipAssignment).filter(
            InternshipAssignment.internship_id == internship.id,
            InternshipAssignment.is_active == True
        ).count()
        
        # Get assigned students (for quick preview)
        assignments = db.query(InternshipAssignment).filter(
            InternshipAssignment.internship_id == internship.id,
            InternshipAssignment.is_active == True
        ).limit(5).all()
        
        student_names = []
        for assignment in assignments:
            student = db.query(Student).filter(Student.id == assignment.student_id).first()
            if student:
                student_names.append(student.name)
        
        result.append({
            "id": internship.id,
            "name": internship.name,
            "company_name": company.name if company else "Unknown",
            "description": internship.description,
            "start_date": internship.start_date,
            "end_date": internship.end_date,
            "daily_start_time": str(internship.daily_start_time) if internship.daily_start_time else None,
            "daily_end_time": str(internship.daily_end_time) if internship.daily_end_time else None,
            "is_paid": internship.is_paid,
            "stipend_amount": internship.stipend_amount,
            "status": internship.status,
            "student_count": student_count,
            "preview_students": student_names[:5],
            "remaining_students": max(0, student_count - 5)
        })
    
    return {
        "total_internships": len(result),
        "internships": result
    }


@router.get("/internship/{internship_id}")
async def get_manager_internship_detail(
    internship_id: int,
    authorization: str = Header(None),
    db: DBSession = Depends(get_db)
):
    """Get detailed view of a specific internship with all assigned students"""
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    user = validate_jwt_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Get internship
    internship = db.query(Internship).filter(Internship.id == internship_id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    # Get company
    company = db.query(Company).filter(Company.id == internship.company_id).first()
    
    # Get all assigned students
    assignments = db.query(InternshipAssignment).filter(
        InternshipAssignment.internship_id == internship.id,
        InternshipAssignment.is_active == True
    ).all()
    
    students = []
    for assignment in assignments:
        student = db.query(Student).filter(Student.id == assignment.student_id).first()
        if student:
            students.append({
                "id": student.id,
                "student_id": student.student_id,
                "name": student.name,
                "email": student.email,
                "assigned_at": assignment.assigned_at
            })
    
    return {
        "internship": {
            "id": internship.id,
            "name": internship.name,
            "description": internship.description,
            "company_name": company.name if company else "Unknown",
            "company_id": internship.company_id,
            "start_date": internship.start_date,
            "end_date": internship.end_date,
            "daily_start_time": str(internship.daily_start_time) if internship.daily_start_time else None,
            "daily_end_time": str(internship.daily_end_time) if internship.daily_end_time else None,
            "is_paid": internship.is_paid,
            "stipend_amount": internship.stipend_amount,
            "status": internship.status,
            "created_at": internship.created_at
        },
        "students": students,
        "total_students": len(students)
    }


@router.get("/internship/{internship_id}/available-students")
async def get_available_students(
    internship_id: int,
    authorization: str = Header(None),
    db: DBSession = Depends(get_db)
):
    """Get students who are NOT assigned to any active internship"""
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    user = validate_jwt_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Get all students
    all_students = db.query(Student).filter(Student.is_active == True).all()
    
    # Get IDs of students already assigned to active internships
    assigned_ids = db.query(InternshipAssignment.student_id).join(Internship).filter(
        Internship.status == "active",
        InternshipAssignment.is_active == True
    ).distinct().all()
    
    assigned_id_set = {id[0] for id in assigned_ids}
    
    # Filter available students
    available = []
    for student in all_students:
        if student.id not in assigned_id_set:
            available.append({
                "id": student.id,
                "student_id": student.student_id,
                "name": student.name,
                "email": student.email
            })
    
    return {
        "available_students": available,
        "total_available": len(available)
    }