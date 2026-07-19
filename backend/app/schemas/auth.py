# backend/app/schemas/auth.py
"""
Authentication schemas
"""
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Login request"""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response"""
    access_token: str
    token_type: str = "bearer"
    student_id: str
    name: str


class StudentCreate(BaseModel):
    """Create a new student"""
    student_id: str
    name: str
    email: EmailStr
    password: str
    company_id: int