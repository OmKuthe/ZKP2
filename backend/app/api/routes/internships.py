"""
Internship CRUD endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from typing import Optional, List
from datetime import datetime

from ...models import Internship, Company, Student, InternshipAssignment
from ...core.database import get_db
from ...schemas.internship import (
    InternshipCreate,
    InternshipResponse,
    InternshipUpdate,
    InternshipAssignmentRequest,
)

router = APIRouter(prefix="/admin/internships", tags=["admin"])


@router.post("/", response_model=InternshipResponse)
async def create_internship(
    request: InternshipCreate,
    db: DBSession = Depends(get_db)
):
    """Create a new internship"""
    company = db.query(Company).filter(Company.id == request.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    internship = Internship(
        company_id=request.company_id,
        name=request.name,
        description=request.description,
        start_date=request.start_date,
        end_date=request.end_date,
        daily_start_time=request.daily_start_time,
        daily_end_time=request.daily_end_time,
        is_paid=request.is_paid,
        stipend_amount=request.stipend_amount,
        status="active"
    )
    
    db.add(internship)
    db.commit()
    db.refresh(internship)
    
    return internship


@router.get("/", response_model=List[InternshipResponse])
async def get_internships(
    company_id: Optional[int] = None,
    status: Optional[str] = None,
    db: DBSession = Depends(get_db)
):
    """Get all internships with optional filters"""
    query = db.query(Internship)
    
    if company_id:
        query = query.filter(Internship.company_id == company_id)
    if status:
        query = query.filter(Internship.status == status)
    
    internships = query.all()
    
    # Add student count to each internship
    result = []
    for internship in internships:
        student_count = db.query(InternshipAssignment).filter(
            InternshipAssignment.internship_id == internship.id,
            InternshipAssignment.is_active == True
        ).count()
        
        # Convert to dict and add student_count
        internship_dict = {
            "id": internship.id,
            "company_id": internship.company_id,
            "name": internship.name,
            "description": internship.description,
            "start_date": internship.start_date,
            "end_date": internship.end_date,
            "daily_start_time": internship.daily_start_time,
            "daily_end_time": internship.daily_end_time,
            "is_paid": internship.is_paid,
            "stipend_amount": internship.stipend_amount,
            "status": internship.status,
            "created_at": internship.created_at,
            "student_count": student_count
        }
        result.append(internship_dict)
    
    return result


@router.get("/{internship_id}", response_model=InternshipResponse)
async def get_internship(
    internship_id: int,
    db: DBSession = Depends(get_db)
):
    """Get internship by ID"""
    internship = db.query(Internship).filter(Internship.id == internship_id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    student_count = db.query(InternshipAssignment).filter(
        InternshipAssignment.internship_id == internship_id,
        InternshipAssignment.is_active == True
    ).count()
    
    # Add student_count to response
    internship_dict = {
        "id": internship.id,
        "company_id": internship.company_id,
        "name": internship.name,
        "description": internship.description,
        "start_date": internship.start_date,
        "end_date": internship.end_date,
        "daily_start_time": internship.daily_start_time,
        "daily_end_time": internship.daily_end_time,
        "is_paid": internship.is_paid,
        "stipend_amount": internship.stipend_amount,
        "status": internship.status,
        "created_at": internship.created_at,
        "student_count": student_count
    }
    
    return internship_dict


@router.put("/{internship_id}", response_model=InternshipResponse)
async def update_internship(
    internship_id: int,
    request: InternshipUpdate,
    db: DBSession = Depends(get_db)
):
    """Update internship"""
    internship = db.query(Internship).filter(Internship.id == internship_id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    if request.name is not None:
        internship.name = request.name
    if request.description is not None:
        internship.description = request.description
    if request.start_date is not None:
        internship.start_date = request.start_date
    if request.end_date is not None:
        internship.end_date = request.end_date
    if request.daily_start_time is not None:
        internship.daily_start_time = request.daily_start_time
    if request.daily_end_time is not None:
        internship.daily_end_time = request.daily_end_time
    if request.is_paid is not None:
        internship.is_paid = request.is_paid
    if request.stipend_amount is not None:
        internship.stipend_amount = request.stipend_amount
    if request.status is not None:
        internship.status = request.status
    
    db.commit()
    db.refresh(internship)
    
    # Get student count
    student_count = db.query(InternshipAssignment).filter(
        InternshipAssignment.internship_id == internship.id,
        InternshipAssignment.is_active == True
    ).count()
    
    internship_dict = {
        "id": internship.id,
        "company_id": internship.company_id,
        "name": internship.name,
        "description": internship.description,
        "start_date": internship.start_date,
        "end_date": internship.end_date,
        "daily_start_time": internship.daily_start_time,
        "daily_end_time": internship.daily_end_time,
        "is_paid": internship.is_paid,
        "stipend_amount": internship.stipend_amount,
        "status": internship.status,
        "created_at": internship.created_at,
        "student_count": student_count
    }
    
    return internship_dict


@router.post("/{internship_id}/assign")
async def assign_students(
    internship_id: int,
    request: InternshipAssignmentRequest,
    db: DBSession = Depends(get_db)
):
    """Assign students to an internship (only if not already assigned to another active internship)"""
    internship = db.query(Internship).filter(Internship.id == internship_id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    assigned_count = 0
    errors = []
    
    for student_id in request.student_ids:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            errors.append(f"Student {student_id} not found")
            continue
        
        # ✅ Check if student is already assigned to ANY active internship
        existing = db.query(InternshipAssignment).join(Internship).filter(
            InternshipAssignment.student_id == student_id,
            InternshipAssignment.is_active == True,
            Internship.status == "active"
        ).first()
        
        if existing:
            # Get the internship name for better error message
            existing_int = db.query(Internship).filter(Internship.id == existing.internship_id).first()
            errors.append(f"Student {student.student_id} is already assigned to active internship: {existing_int.name if existing_int else 'Unknown'}")
            continue
        
        assignment = InternshipAssignment(
            internship_id=internship_id,
            student_id=student_id
        )
        db.add(assignment)
        assigned_count += 1
    
    db.commit()
    
    return {
        "message": f"Assigned {assigned_count} students to internship",
        "assigned_count": assigned_count,
        "errors": errors if errors else None
    }


@router.get("/{internship_id}/students")
async def get_internship_students(
    internship_id: int,
    db: DBSession = Depends(get_db)
):
    """Get all students assigned to an internship"""
    internship = db.query(Internship).filter(Internship.id == internship_id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    assignments = db.query(InternshipAssignment).filter(
        InternshipAssignment.internship_id == internship_id,
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
                "assignment_id": assignment.id,
                "is_active": assignment.is_active,
                "assigned_at": assignment.assigned_at
            })
    
    return {
        "internship_id": internship_id,
        "students": students,
        "total": len(students)
    }


@router.delete("/{internship_id}/students/{student_id}")
async def remove_student_from_internship(
    internship_id: int,
    student_id: int,
    db: DBSession = Depends(get_db)
):
    """Remove a student from an internship"""
    assignment = db.query(InternshipAssignment).filter(
        InternshipAssignment.internship_id == internship_id,
        InternshipAssignment.student_id == student_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    db.delete(assignment)
    db.commit()
    
    return {"message": "Student removed from internship"}

# Add this after the remove_student_from_internship endpoint

@router.delete("/{internship_id}")
async def delete_internship(
    internship_id: int,
    db: DBSession = Depends(get_db)
):
    """Delete an internship by ID"""
    internship = db.query(Internship).filter(Internship.id == internship_id).first()
    if not internship:
        raise HTTPException(status_code=404, detail="Internship not found")
    
    # Check if any students are assigned
    assignment_count = db.query(InternshipAssignment).filter(
        InternshipAssignment.internship_id == internship_id,
        InternshipAssignment.is_active == True
    ).count()
    
    if assignment_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete internship. {assignment_count} students are still assigned. Remove all students first."
        )
    
    # Delete the internship
    db.delete(internship)
    db.commit()
    
    return {"message": f"Internship {internship.name} deleted successfully"}