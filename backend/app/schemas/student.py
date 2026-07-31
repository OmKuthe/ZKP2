# backend/app/schemas/student.py
"""
Student schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict ,Any

# ---------- Student CRUD ----------

class StudentCreate(BaseModel):
    student_id: str
    name: str
    email: EmailStr
    password: str
    company_id: Optional[int] = None
    
class StudentResponse(BaseModel):
    """Student response"""
    id: int
    student_id: str
    name: str
    email: EmailStr
    company_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True


class StudentUpdate(BaseModel):
    """Update student"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    company_id: Optional[int] = None
    is_active: Optional[bool] = None


# ---------- GPS Verification ----------
class GPSVerificationRequest(BaseModel):
    student_id: str
    latitude: float
    longitude: float


class GPSVerificationResponse(BaseModel):
    verified: bool
    message: str
    distance: float
    max_distance: float
    qr_token: Optional[str] = None
    qr_payload: Optional[Dict] = None


# ---------- Student Entry / Exit ----------
class StudentEntryRequest(BaseModel):
    student_id: str
    company_id: int
    qr_token: str
    zk_proof: Optional[Dict[str, Any]] = None


class StudentEntryResponse(BaseModel):
    session_id: str
    message: str
    entry_time: int
