from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
from passlib.context import CryptContext

from ..database import get_db
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory session store (replace with Redis in production)
active_sessions = {}

class StudentLoginSchema(BaseModel):
    student_id: str

class ManagerLoginSchema(BaseModel):
    manager_id: str
    password: str

class AdminLoginSchema(BaseModel):
    admin_id: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user_type: str
    user_id: str
    full_name: str
    expires_at: str

def get_current_user(token: str):
    """Get current user from token"""
    if token in active_sessions:
        session = active_sessions[token]
        if session["expires"] > datetime.now():
            return session
    return None

@router.post("/student/login", response_model=LoginResponse)
async def student_login(
    login: StudentLoginSchema,
    db: AsyncSession = Depends(get_db)
):
    # Verify student exists
    result = await db.execute(
        select(User).where(
            and_(User.user_id == login.student_id, User.user_type == "student")
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid student ID")
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=12)
    
    active_sessions[token] = {
        "user_id": user.user_id,
        "user_type": "student",
        "full_name": user.full_name,
        "expires": expires_at
    }
    
    return LoginResponse(
        token=token,
        user_type="student",
        user_id=user.user_id,
        full_name=user.full_name,
        expires_at=expires_at.isoformat()
    )

@router.post("/manager/login", response_model=LoginResponse)
async def manager_login(
    login: ManagerLoginSchema,
    db: AsyncSession = Depends(get_db)
):
    # Verify manager exists
    result = await db.execute(
        select(User).where(
            and_(User.user_id == login.manager_id, User.user_type == "manager")
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not pwd_context.verify(login.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account disabled")
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=8)
    
    active_sessions[token] = {
        "user_id": user.user_id,
        "user_type": "manager",
        "full_name": user.full_name,
        "expires": expires_at
    }
    
    return LoginResponse(
        token=token,
        user_type="manager",
        user_id=user.user_id,
        full_name=user.full_name,
        expires_at=expires_at.isoformat()
    )

@router.post("/admin/login", response_model=LoginResponse)
async def admin_login(
    login: AdminLoginSchema,
    db: AsyncSession = Depends(get_db)
):
    # Verify admin exists
    result = await db.execute(
        select(User).where(
            and_(User.user_id == login.admin_id, User.user_type == "admin")
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not pwd_context.verify(login.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=8)
    
    active_sessions[token] = {
        "user_id": user.user_id,
        "user_type": "admin",
        "full_name": user.full_name,
        "expires": expires_at
    }
    
    return LoginResponse(
        token=token,
        user_type="admin",
        user_id=user.user_id,
        full_name=user.full_name,
        expires_at=expires_at.isoformat()
    )

@router.post("/logout")
async def logout(authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        if token in active_sessions:
            del active_sessions[token]
    return {"message": "Logged out successfully"}

@router.get("/verify")
async def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return {"valid": False}
    
    token = authorization.replace("Bearer ", "")
    user = get_current_user(token)
    
    if user:
        return {
            "valid": True,
            "user_id": user["user_id"],
            "user_type": user["user_type"],
            "full_name": user["full_name"]
        }
    return {"valid": False}