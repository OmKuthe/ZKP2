# backend/app/api/routes/admin.py
"""
Admin APIs - Phase 2E
T&P Coordinator and Company Admin endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Optional, List

from ...models import Student, Company, Session, Anomaly
from ...core.database import get_db

# ✅ Fix: Use relative imports for schemas
from ...schemas.admin import (
    CompanySummary,
    StudentSummary,
    SessionSummary,
    AnomalySummary,
    DashboardStats,
    CompanyListResponse,
    StudentListResponse,
    SessionListResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ==================== T&P Coordinator Endpoints ====================

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: DBSession = Depends(get_db)
):
    """Get overall stats for T&P Coordinator dashboard"""
    
    # Total companies
    total_companies = db.query(Company).filter(Company.is_active == True).count()
    
    # Total students
    total_students = db.query(Student).filter(Student.is_active == True).count()
    
    # Active sessions today
    today = datetime.now().date()
    active_sessions = db.query(Session).filter(
        Session.status == "active",
        func.date(Session.entry_time) == today
    ).count()
    
    # Completed sessions today
    completed_sessions = db.query(Session).filter(
        Session.status == "completed",
        func.date(Session.entry_time) == today
    ).count()
    
    # Anomalies (unresolved)
    unresolved_anomalies = db.query(Anomaly).filter(
        Anomaly.resolved == False
    ).count()
    
    # Attendance rate (today)
    total_today = active_sessions + completed_sessions
    attendance_rate = (completed_sessions / total_today * 100) if total_today > 0 else 0
    
    return DashboardStats(
        total_companies=total_companies,
        total_students=total_students,
        active_sessions=active_sessions,
        completed_sessions=completed_sessions,
        attendance_rate=round(attendance_rate, 1),
        unresolved_anomalies=unresolved_anomalies,
    )


@router.get("/companies", response_model=CompanyListResponse)
async def get_companies(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: DBSession = Depends(get_db)
):
    """Get all companies with student counts"""
    offset = (page - 1) * limit
    
    companies = db.query(Company).filter(Company.is_active == True).offset(offset).limit(limit).all()
    total = db.query(Company).filter(Company.is_active == True).count()
    
    results = []
    for company in companies:
        student_count = db.query(Student).filter(
            Student.company_id == company.id,
            Student.is_active == True
        ).count()
        
        active_sessions = db.query(Session).filter(
            Session.company_id == company.id,
            Session.status == "active"
        ).count()
        
        results.append(
            CompanySummary(
                id=company.id,
                name=company.name,
                student_count=student_count,
                active_sessions=active_sessions,
                geofence_radius=company.geofence_radius,
                is_active=company.is_active,
                created_at=company.created_at,
            )
        )
    
    return CompanyListResponse(
        companies=results,
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/students", response_model=StudentListResponse)
async def get_students(
    company_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: DBSession = Depends(get_db)
):
    """Get all students (filtered by company if provided)"""
    offset = (page - 1) * limit
    
    query = db.query(Student).filter(Student.is_active == True)
    if company_id:
        query = query.filter(Student.company_id == company_id)
    
    students = query.offset(offset).limit(limit).all()
    total = query.count()
    
    results = []
    for student in students:
        company = db.query(Company).filter(Company.id == student.company_id).first()
        active_session = db.query(Session).filter(
            Session.student_id == student.id,
            Session.status == "active"
        ).first()
        
        results.append(
            StudentSummary(
                id=student.id,
                student_id=student.student_id,
                name=student.name,
                email=student.email,
                company_name=company.name if company else None,
                has_active_session=active_session is not None,
                created_at=student.created_at,
            )
        )
    
    return StudentListResponse(
        students=results,
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(
    company_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: DBSession = Depends(get_db)
):
    """Get sessions with filters"""
    offset = (page - 1) * limit
    
    query = db.query(Session)
    
    if company_id:
        query = query.filter(Session.company_id == company_id)
    if student_id:
        query = query.filter(Session.student_id == student_id)
    if status:
        query = query.filter(Session.status == status)
    
    sessions = query.order_by(desc(Session.entry_time)).offset(offset).limit(limit).all()
    total = query.count()
    
    results = []
    for session in sessions:
        student = db.query(Student).filter(Student.id == session.student_id).first()
        company = db.query(Company).filter(Company.id == session.company_id).first()
        
        duration_minutes = int(session.total_duration_seconds / 60) if session.total_duration_seconds else 0
        
        # Check for anomalies
        has_anomaly = db.query(Anomaly).filter(Anomaly.session_id == session.id).count() > 0
        
        results.append(
            SessionSummary(
                id=session.id,
                session_id=session.session_id,
                student_name=student.name if student else None,
                student_id=student.student_id if student else None,
                company_name=company.name if company else None,
                entry_time=session.entry_time,
                exit_time=session.exit_time,
                duration_minutes=duration_minutes,
                status=session.status,
                has_anomaly=has_anomaly,
                created_at=session.created_at,
            )
        )
    
    return SessionListResponse(
        sessions=results,
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/anomalies", response_model=List[AnomalySummary])
async def get_anomalies(
    resolved: Optional[bool] = Query(None),
    db: DBSession = Depends(get_db)
):
    """Get anomalies (filtered by resolved status)"""
    query = db.query(Anomaly)
    if resolved is not None:
        query = query.filter(Anomaly.resolved == resolved)
    
    anomalies = query.order_by(desc(Anomaly.created_at)).all()
    
    results = []
    for anomaly in anomalies:
        student = db.query(Student).filter(Student.id == anomaly.student_id).first()
        company = db.query(Company).filter(Company.id == anomaly.company_id).first()
        
        results.append(
            AnomalySummary(
                id=anomaly.id,
                type=anomaly.type,
                severity=anomaly.severity,
                description=anomaly.description,
                student_name=student.name if student else None,
                company_name=company.name if company else None,
                resolved=anomaly.resolved,
                created_at=anomaly.created_at,
            )
        )
    
    return results


@router.post("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: int,
    db: DBSession = Depends(get_db)
):
    """Resolve an anomaly"""
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    
    anomaly.resolved = True
    anomaly.resolved_at = datetime.now()
    db.commit()
    
    return {"message": "Anomaly resolved", "anomaly_id": anomaly_id}