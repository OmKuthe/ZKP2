# backend/app/main.py
"""
ZKAttend Phase 2A - Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import (
    engine,
    Base,
    _ensure_unique_active_session_index,
)

# Import all models so they get registered
from .models import (
    Company,
    Student,
    Session,
    ContinuityCheck,
    Anomaly,
    Internship,
    InternshipAssignment,
    WiFiTemplate,
    WiFiVerification,
)
# Import API router
from .api import router as api_router

# Create database tables
Base.metadata.create_all(bind=engine)

# Flaw #4: enforce at most one active session per student, at the DB level.
_ensure_unique_active_session_index()

# Initialize app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": "sqlite"}

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": settings.DATABASE_URL.split("://")[0]
    }