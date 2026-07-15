from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from ..database import get_db
from ..models import Session as SessionModel, User, FacultyProfile
import secrets
import datetime
from typing import Optional

router = APIRouter()

# Helper function to get current user (duplicate from auth to avoid circular import)
def get_current_user(token: str):
    """Simple token validation - in production, use JWT"""
    from ..api.auth import active_sessions
    if token in active_sessions:
        session = active_sessions[token]
        if session["expires"] > datetime.datetime.now():
            return session
    return None

@router.post("/start")
async def start_session(
    faculty_id: str,
    lat: float,
    lng: float,
    radius: int,
    duration_minutes: int = 60,
    department: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    subject: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        # Verify faculty exists and is authenticated
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid token")
        
        token = authorization.replace("Bearer ", "")
        current_user = get_current_user(token)
        
        if not current_user or current_user["user_type"] != "faculty":
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if current_user["user_id"] != faculty_id:
            raise HTTPException(status_code=403, detail="Faculty ID mismatch")
        
        # Verify faculty exists in database
        faculty_result = await db.execute(
            select(User).where(User.user_id == faculty_id)
        )
        faculty = faculty_result.scalar_one_or_none()
        
        if not faculty or not faculty.is_active:
            raise HTTPException(status_code=404, detail="Faculty not found")
        
        nonce = secrets.token_hex(16)
        start_time = datetime.datetime.utcnow()
        end_time = start_time + datetime.timedelta(minutes=duration_minutes)
        
        # Get faculty department if not provided
        if not department:
            faculty_profile = await db.execute(
                select(FacultyProfile).where(FacultyProfile.faculty_id == faculty_id)
            )
            profile = faculty_profile.scalar_one_or_none()
            dept = profile.department if profile else "General"
        else:
            dept = department
        
        new_session = SessionModel(
            session_nonce=nonce,
            faculty_id=faculty_id,
            class_center_lat=lat,
            class_center_lng=lng,
            radius_meters=radius,
            start_time=start_time,
            end_time=end_time,
            department=dept,
            subject=subject or "General"
        )
        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        
        return {
            "session_nonce": nonce, 
            "start_time": start_time.isoformat(), 
            "end_time": end_time.isoformat(),
            "department": dept
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in start_session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/{nonce}")
async def get_session(
    nonce: str, 
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(
            select(SessionModel).where(SessionModel.session_nonce == nonce)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "session_nonce": session.session_nonce,
            "faculty_id": session.faculty_id,
            "class_center_lat": session.class_center_lat,
            "class_center_lng": session.class_center_lng,
            "radius_meters": session.radius_meters,
            "start_time": session.start_time.isoformat(),
            "end_time": session.end_time.isoformat(),
            "department": session.department,
            "is_active": session.start_time <= datetime.datetime.utcnow() <= session.end_time
        }
    except Exception as e:
        print(f"Error in get_session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/active/current")
async def get_active_sessions(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    try:
        now = datetime.datetime.utcnow()
        query = select(SessionModel).where(
            and_(
                SessionModel.start_time <= now,
                SessionModel.end_time >= now
            )
        )
        
        if department:
            query = query.where(SessionModel.department == department)
        
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        return [
            {
                "session_nonce": s.session_nonce,
                "faculty_id": s.faculty_id,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "department": s.department,
                "radius_meters": s.radius_meters,
                "class_center_lat": s.class_center_lat,
                "class_center_lng": s.class_center_lng
            } for s in sessions
        ]
    except Exception as e:
        print(f"Error in get_active_sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/faculty/{faculty_id}/sessions")
async def get_faculty_sessions(
    faculty_id: str,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Verify authentication
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid token")
        
        token = authorization.replace("Bearer ", "")
        current_user = get_current_user(token)
        
        if not current_user or (current_user["user_type"] != "faculty" and current_user["user_type"] != "admin"):
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if current_user["user_type"] == "faculty" and current_user["user_id"] != faculty_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        result = await db.execute(
            select(SessionModel)
            .where(SessionModel.faculty_id == faculty_id)
            .order_by(SessionModel.start_time.desc())
        )
        sessions = result.scalars().all()
        
        return [
            {
                "session_nonce": s.session_nonce,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "class_center": {"lat": s.class_center_lat, "lng": s.class_center_lng},
                "radius_meters": s.radius_meters,
                "department": s.department
            } for s in sessions
        ]
    except Exception as e:
        print(f"Error in get_faculty_sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")