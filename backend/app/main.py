# backend/app/main.py
"""
ZKAttend Phase 2A - Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import engine, Base

# Import all models so they get registered
from .models import Company, Student, Session, ContinuityCheck, Anomaly

# Create database tables
Base.metadata.create_all(bind=engine)

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


# Import and include routes (we'll add these later)
# from .api.routes import auth, sessions, qr
# app.include_router(auth.router)
# app.include_router(sessions.router)
# app.include_router(qr.router)