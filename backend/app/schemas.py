from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time

# ========== Auth Schemas ==========
class StudentLogin(BaseModel):
    student_id: str

class ManagerLogin(BaseModel):
    manager_id: str
    password: str

class AdminLogin(BaseModel):
    admin_id: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user_type: str
    user_id: str
    full_name: str
    expires_at: str

# ========== User Management Schemas ==========
class StudentCreate(BaseModel):
    student_id: str
    email: EmailStr
    full_name: str
    roll_number: str
    course: str
    year: int
    semester: int
    phone_number: str
    department: str
    password: Optional[str] = None

class ManagerCreate(BaseModel):
    manager_id: str
    email: EmailStr
    full_name: str
    designation: str
    department: str
    phone_number: str
    password: str

# ========== Company Schemas ==========
class CompanyCreate(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    radius_meters: int = 200

class CompanyResponse(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    radius_meters: int

# ========== Internship Schemas ==========
class InternshipCreate(BaseModel):
    company_id: int
    role_name: str
    description: str
    manager_id: str
    start_date: date
    end_date: date
    daily_start_time: time
    daily_end_time: time
    lunch_break_minutes: int = 60
    required_hours_per_day: float
    min_hours_for_present: float = 6.0

class InternshipResponse(BaseModel):
    internship_id: str
    company_name: str
    role_name: str
    manager_id: str
    start_date: date
    end_date: date
    daily_start_time: str
    daily_end_time: str
    status: str

# ========== Attendance Schemas ==========
class AttendanceSubmit(BaseModel):
    internship_id: str
    student_id: str
    latitude: float
    longitude: float
    proof_type: str = "hourly"  # 'entry', 'hourly', 'exit'
    zk_proof: Optional[Dict[str, Any]] = None
    public_signals: Optional[List[str]] = None

class AttendanceResponse(BaseModel):
    status: str
    verified: bool
    message: str
    proof_id: Optional[int] = None

class DailyAttendanceResponse(BaseModel):
    date: date
    total_hours: float
    status: str
    proof_count: int
    first_proof: Optional[str]
    last_proof: Optional[str]

# ========== Holiday Schemas ==========
class HolidayCreate(BaseModel):
    date: date
    name: str
    description: Optional[str] = None
    company_id: Optional[int] = None

# ========== Manual Override Schemas ==========
class ManualOverrideCreate(BaseModel):
    attendance_id: int
    new_status: str
    reason: str