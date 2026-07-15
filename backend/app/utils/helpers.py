import hashlib
import math
from datetime import datetime, time, date, timedelta
from typing import Tuple

def hash_student_id(student_id: str, salt: str = "zkattend_salt_2026") -> str:
    """Hash student ID for privacy"""
    combined = f"{salt}:{student_id}"
    return hashlib.sha256(combined.encode()).hexdigest()

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula"""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2) * math.sin(delta_lat/2) + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * \
        math.sin(delta_lon/2) * math.sin(delta_lon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def is_within_radius(lat1: float, lon1: float, lat2: float, lon2: float, radius: float) -> bool:
    """Check if point is within radius of center"""
    distance = calculate_distance(lat1, lon1, lat2, lon2)
    return distance <= radius

def calculate_attendance_hours(start_time: datetime, end_time: datetime, lunch_break_minutes: int = 60) -> float:
    """Calculate total hours worked excluding lunch break"""
    total_minutes = (end_time - start_time).total_seconds() / 60
    # Subtract lunch break if the duration spans typical lunch hours (12:00-14:00)
    # Simplified: just subtract lunch break if total_minutes > lunch_break_minutes + 60
    if total_minutes > (lunch_break_minutes + 60):
        total_minutes -= lunch_break_minutes
    return round(total_minutes / 60, 2)

def generate_internship_id() -> str:
    """Generate unique internship ID"""
    import secrets
    return f"INT_{secrets.token_hex(4).upper()}"

def is_holiday(date: date, holidays: list) -> bool:
    """Check if date is a holiday"""
    return any(holiday.date == date for holiday in holidays)

def get_attendance_status(total_hours: float, required_hours: float, min_hours: float) -> str:
    """Determine attendance status based on hours"""
    if total_hours >= required_hours:
        return "full_day"
    elif total_hours >= min_hours:
        return "partial"
    else:
        return "absent"