"""
QR Challenge API Endpoints for Phase 2
Provides endpoints for generating, verifying, and managing QR challenges
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from ..database import get_db
from ..models import Internship, Company, StudentProfile
from ..services import QRService
from ..services.qr_service import QRChallenge, QRPayload, get_qr_service
from .auth import get_current_user
from sqlalchemy import select, and_

router = APIRouter(prefix="/api/qr", tags=["qr-challenge"])


async def verify_student(token: str, db: AsyncSession, student_id: str = None):
    """Verify student authentication"""
    current_user = get_current_user(token)
    if not current_user or current_user["user_type"] != "student":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if student_id and current_user["user_id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user


@router.get("/challenge/{company_id}", response_model=QRChallenge)
async def get_qr_challenge(
    company_id: int,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
    qr_service: QRService = Depends(get_qr_service)
):
    """
    Get current QR challenge for student at company.
    Returns a TOTP-style challenge valid for 30 seconds.
    
    Path Parameters:
        company_id: Company ID where student is interning
        
    Returns:
        QRChallenge with token, timestamp, and expiry
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    student_id = current_user["user_id"]
    
    # Verify company exists
    company_result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = company_result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Verify student has active internship at this company
    student_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    student_profile = student_result.scalar_one_or_none()
    
    if not student_profile or not student_profile.current_internship_id:
        raise HTTPException(status_code=400, detail="No active internship found")
    
    internship_result = await db.execute(
        select(Internship).where(
            and_(
                Internship.id == student_profile.current_internship_id,
                Internship.company_id == company_id
            )
        )
    )
    internship = internship_result.scalar_one_or_none()
    if not internship:
        raise HTTPException(status_code=400, detail="Student not enrolled at this company")
    
    # Generate and return challenge
    challenge = await qr_service.generate_challenge(
        student_id=student_id,
        company_id=company_id,
        internship_id=internship.id
    )
    return challenge


@router.get("/current/{company_id}", response_model=QRChallenge)
async def get_current_qr_challenge(
    company_id: int,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
    qr_service: QRService = Depends(get_qr_service)
):
    """
    Get current valid QR challenge (cached if not expired, new if expired).
    
    Path Parameters:
        company_id: Company ID where student is interning
        
    Returns:
        Current valid QRChallenge
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    student_id = current_user["user_id"]
    
    # Verify company exists
    company_result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = company_result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get current challenge
    challenge = await qr_service.get_current_challenge(
        student_id=student_id,
        company_id=company_id
    )
    return challenge


@router.get("/payload/{company_id}", response_model=QRPayload)
async def get_qr_payload(
    company_id: int,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
    qr_service: QRService = Depends(get_qr_service)
):
    """
    Get QR payload ready for QR code generation (contains unix timestamps).
    
    Path Parameters:
        company_id: Company ID where student is interning
        
    Returns:
        QRPayload with student_id, company_id, token, and unix timestamps
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    current_user = await verify_student(token, db)
    student_id = current_user["user_id"]
    
    # Verify company exists
    company_result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = company_result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get payload
    payload = await qr_service.get_qr_payload(
        student_id=student_id,
        company_id=company_id
    )
    return payload


class VerifyQRRequest:
    """Request schema for QR verification"""
    token: str
    company_id: int


class VerifyQRResponse:
    """Response schema for QR verification"""
    valid: bool
    student_id: str
    company_id: int
    message: str
    timestamp: str


@router.post("/verify/{company_id}")
async def verify_qr_token(
    company_id: int,
    token: str,  # Query parameter
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
    qr_service: QRService = Depends(get_qr_service)
):
    """
    Verify a QR challenge token and prevent replay attacks.
    
    Path Parameters:
        company_id: Company ID
        
    Query Parameters:
        token: Token to verify
        
    Returns:
        Verification result with validity status
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    auth_token = authorization.replace("Bearer ", "")
    current_user = await verify_student(auth_token, db)
    student_id = current_user["user_id"]
    
    # Verify company exists
    company_result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = company_result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Verify token
    result = await qr_service.verify_challenge(
        token=token,
        student_id=student_id,
        company_id=company_id
    )
    
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.post("/mark-used/{company_id}")
async def mark_qr_used(
    company_id: int,
    token: str,  # Query parameter
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
    qr_service: QRService = Depends(get_qr_service)
):
    """
    Explicitly mark a QR challenge as used (additional tracking).
    
    Path Parameters:
        company_id: Company ID
        
    Query Parameters:
        token: Token to mark as used
        
    Returns:
        Success confirmation
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    auth_token = authorization.replace("Bearer ", "")
    current_user = await verify_student(auth_token, db)
    student_id = current_user["user_id"]
    
    # Mark as used
    success = await qr_service.mark_challenge_used(
        student_id=student_id,
        company_id=company_id,
        token=token
    )
    
    return {
        "success": success,
        "message": "QR challenge marked as used",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
