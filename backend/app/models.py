from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, Time, Date, JSON
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    user_type = Column(String)  # 'admin', 'manager', 'student'
    department = Column(String, nullable=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class StudentProfile(Base):
    __tablename__ = "student_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True)
    roll_number = Column(String)
    course = Column(String)
    year = Column(Integer)
    semester = Column(Integer)
    phone_number = Column(String)
    current_internship_id = Column(Integer, ForeignKey("internships.id"), nullable=True)
    total_hours_completed = Column(Float, default=0)
    total_days_present = Column(Integer, default=0)

class ManagerProfile(Base):
    __tablename__ = "manager_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(String, unique=True, index=True)
    designation = Column(String)
    phone_number = Column(String)
    department = Column(String)
    managed_internships = Column(JSON, default=list)

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    address = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    radius_meters = Column(Integer, default=200)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Holiday(Base):
    __tablename__ = "holidays"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    is_global = Column(Boolean, default=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_by = Column(String)

class Internship(Base):
    __tablename__ = "internships"
    
    id = Column(Integer, primary_key=True, index=True)
    internship_id = Column(String, unique=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    role_name = Column(String)
    description = Column(Text)
    manager_id = Column(String, index=True)
    start_date = Column(Date)
    end_date = Column(Date)
    daily_start_time = Column(Time)
    daily_end_time = Column(Time)
    lunch_break_minutes = Column(Integer, default=60)
    required_hours_per_day = Column(Float)
    min_hours_for_present = Column(Float, default=6.0)
    status = Column(String)  # 'upcoming', 'active', 'completed'
    # Demo mode fields
    is_test_mode = Column(Integer, default=0)
    test_duration_minutes = Column(Integer, default=60)
    proof_interval_minutes = Column(Integer, default=60)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_paid = Column(Integer, default=0)  # 0 = unpaid, 1 = paid
    stipend_amount = Column(Integer, default=0)  # Monthly stipend amount in INR

class InternshipEnrollment(Base):
    __tablename__ = "internship_enrollments"
    
    id = Column(Integer, primary_key=True, index=True)
    internship_id = Column(Integer, ForeignKey("internships.id"))
    student_id = Column(String, index=True)
    enrolled_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default='active')

class DailyAttendance(Base):
    __tablename__ = "daily_attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    internship_id = Column(Integer, ForeignKey("internships.id"))
    student_id = Column(String, index=True)
    date = Column(Date, index=True)
    first_proof_time = Column(DateTime, nullable=True)
    last_proof_time = Column(DateTime, nullable=True)
    total_minutes = Column(Integer, default=0)
    total_hours = Column(Float, default=0)
    proof_count = Column(Integer, default=0)
    status = Column(String)  # 'full_day', 'partial', 'absent', 'in_progress'
    is_verified = Column(Boolean, default=False)

class AttendanceProof(Base):
    __tablename__ = "attendance_proofs"
    
    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("daily_attendance.id"))
    student_id = Column(String, index=True)
    internship_id = Column(Integer, ForeignKey("internships.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    distance_from_company = Column(Float, nullable=True)
    zk_proof = Column(Text, nullable=True)
    public_signals = Column(Text, nullable=True)
    proof_type = Column(String)  # 'entry', 'hourly', 'exit'
    is_valid = Column(Boolean, default=True)
    verified_at = Column(DateTime, nullable=True)

class ManualOverride(Base):
    __tablename__ = "manual_overrides"
    
    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("daily_attendance.id"))
    student_id = Column(String)
    internship_id = Column(Integer)
    original_status = Column(String)
    new_status = Column(String)
    reason = Column(Text)
    changed_by = Column(String)
    changed_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)