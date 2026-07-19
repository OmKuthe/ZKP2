# backend/app/schemas/student.py
"""
Student schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional


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