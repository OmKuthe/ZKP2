# backend/app/schemas/__init__.py
from .auth import LoginRequest, LoginResponse, StudentCreate
from .company import CompanyCreate, CompanyResponse, CompanyUpdate
from .student import StudentResponse, StudentUpdate
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

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "StudentCreate",
    
    # Company
    "CompanyCreate",
    "CompanyResponse",
    "CompanyUpdate",
    
    # Student
    "StudentResponse",
    "StudentUpdate",
    
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
]