# backend/app/models/__init__.py

from .company import Company
from .student import Student
from .session import Session
from .continuity_check import ContinuityCheck
from .anomaly import Anomaly
from .internship import Internship
from .internship_assignments import InternshipAssignment

__all__ = [
    "Company",
    "Student",
    "Session",
    "ContinuityCheck",
    "Anomaly",
    "Internship",
    "InternshipAssignment",
]
