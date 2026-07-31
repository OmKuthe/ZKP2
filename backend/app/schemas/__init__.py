# backend/app/schemas/__init__.py
from .auth import LoginRequest, LoginResponse
from .company import CompanyCreate, CompanyResponse
from .student import StudentCreate, StudentResponse
from .session import SessionResponse, SessionListResponse
from .qr import (
    QRRequest,
    QRResponse,
    EntryRequest,
    EntryResponse,
    ExitRequest,
    ExitResponse,
    VerifyContinuityRequest,
    VerifyContinuityResponse,
)
from .admin import (
    CompanySummary,
    StudentSummary,
    SessionSummary,
    AnomalySummary,
    DashboardStats,
    CompanyListResponse,
    StudentListResponse,
    SessionListResponse,
)
from .internship import (
    InternshipCreate,
    InternshipUpdate,
    InternshipResponse,
    InternshipAssignmentRequest,
    InternshipAssignmentResponse,
)



__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    # Company
    "CompanyCreate",
    "CompanyResponse",
    # Student
    "StudentCreate",
    "StudentResponse",
    # Session
    "SessionResponse",
    "SessionListResponse",
    # QR
    "QRRequest",
    "QRResponse",
    "EntryRequest",
    "EntryResponse",
    "ExitRequest",
    "ExitResponse",
    "VerifyContinuityRequest",
    "VerifyContinuityResponse",
    # Admin
    "CompanySummary",
    "StudentSummary",
    "SessionSummary",
    "AnomalySummary",
    "DashboardStats",
    "CompanyListResponse",
    "StudentListResponse",
    "SessionListResponse",
    # Internship
    "InternshipCreate",
    "InternshipUpdate",
    "InternshipResponse",
    "InternshipAssignmentRequest",
    "InternshipAssignmentResponse",
]