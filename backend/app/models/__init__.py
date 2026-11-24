# backend/app/models/__init__.py
"""
Model exports. V1 models are the source of truth for existing tables
(students, sessions, companies, internships, internship_assignments,
anomalies, continuity_checks, wifi_templates, wifi_verifications).
V2 models (in models_v2.py) are the source of truth for new tables.

Both are re-exported here so that `from app.models import X` keeps working
for V1 code, and V2 routes can do `from app.models import VerificationEvent,
PresenceChallenge, ...` without a second import path.
"""
# ---------- V1 models (unchanged) ----------
from .company import Company
from .student import Student
from .session import Session
from .continuity_check import ContinuityCheck
from .anomaly import Anomaly
from .internship import Internship
from .internship_assignments import InternshipAssignment
from .wifi_template import WiFiTemplate
from .wifi_verification import WiFiVerification

# ---------- V2 models (new tables only) ----------
from ..models_v2 import (
    User,
    StudentProfile,
    Device,
    ZkpVerification,
    FaceVerification,
    VerificationEvent,
    PresenceChallenge,
    AuditLog,
    SchemaMigration,
    # Enums
    UserRole,
    SessionStatus,
    AnomalyStatus,
    AnomalySeverity,
    VerificationLayer,
    VerificationEventType,
    ChallengeStatus,
    # Migration hint for existing-table ALTERs
    V2_COLUMN_EXTENSIONS,
)

__all__ = [
    # V1
    "Company", "Student", "Session", "ContinuityCheck", "Anomaly",
    "Internship", "InternshipAssignment", "WiFiTemplate", "WiFiVerification",
    # V2
    "User", "StudentProfile", "Device", "ZkpVerification", "FaceVerification",
    "VerificationEvent", "PresenceChallenge", "AuditLog", "SchemaMigration",
    # Enums
    "UserRole", "SessionStatus", "AnomalyStatus", "AnomalySeverity",
    "VerificationLayer", "VerificationEventType", "ChallengeStatus",
    # Migration metadata
    "V2_COLUMN_EXTENSIONS",
]