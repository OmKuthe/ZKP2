"""
Internship schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, time


class InternshipCreate(BaseModel):
    company_id: int
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    # ✅ NEW
    daily_start_time: Optional[time] = None
    daily_end_time: Optional[time] = None
    is_paid: bool = False
    stipend_amount: Optional[float] = None


class InternshipUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    daily_start_time: Optional[time] = None
    daily_end_time: Optional[time] = None
    is_paid: Optional[bool] = None
    stipend_amount: Optional[float] = None
    status: Optional[str] = None


class InternshipResponse(BaseModel):
    id: int
    company_id: int
    name: str
    description: Optional[str]
    start_date: datetime
    end_date: datetime
    daily_start_time: Optional[time]
    daily_end_time: Optional[time]
    is_paid: bool
    stipend_amount: Optional[float]
    status: str
    created_at: datetime
    student_count: Optional[int] = 0

    class Config:
        from_attributes = True


class InternshipAssignmentRequest(BaseModel):
    student_ids: List[int]


class InternshipAssignmentResponse(BaseModel):
    internship_id: int
    student_id: int
    is_active: bool
    assigned_at: datetime

    class Config:
        from_attributes = True