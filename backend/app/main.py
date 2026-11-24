# backend/app/main.py
"""
ZKAttend Phase 2A - Main Application (with Phase 4 sweeper)
"""
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import (
    engine, Base, _ensure_unique_active_session_index, SessionLocal,
)
from .models import (
    Company, Student, Session, ContinuityCheck, Anomaly,
    Internship, InternshipAssignment, WiFiTemplate, WiFiVerification,
)
from .api import router as api_router
from .services.challenges import sweep_expired_challenges

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)
_ensure_unique_active_session_index()

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, debug=settings.DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


# ---------- Phase 4: challenge expiry sweeper ----------

_sweeper_task: asyncio.Task | None = None


async def _challenge_sweeper():
    interval = max(5, settings.V2_CHALLENGE_SWEEP_INTERVAL_SEC)
    logger.info(f"⏱  Challenge sweeper started (every {interval}s)")
    try:
        while True:
            await asyncio.sleep(interval)
            try:
                db = SessionLocal()
                try:
                    n = sweep_expired_challenges(db)
                    if n:
                        db.commit()
                        logger.info(f"⏱  Swept {n} expired challenge(s)")
                except Exception as e:
                    db.rollback()
                    logger.exception(f"⚠️ Sweeper iteration failed: {e}")
                finally:
                    db.close()
            except Exception as e:
                logger.exception(f"⚠️ Sweeper outer error: {e}")
    except asyncio.CancelledError:
        logger.info("⏱  Challenge sweeper cancelled")
        raise


@app.on_event("startup")
async def _start_sweeper():
    global _sweeper_task
    if settings.V2_CHALLENGES_ENABLED:
        _sweeper_task = asyncio.create_task(_challenge_sweeper())
        logger.info("⏱  Challenge sweeper scheduled")
    else:
        logger.info("⏸  Challenge sweeper disabled (V2_CHALLENGES_ENABLED=false)")


@app.on_event("shutdown")
async def _stop_sweeper():
    global _sweeper_task
    if _sweeper_task and not _sweeper_task.done():
        _sweeper_task.cancel()
        try:
            await _sweeper_task
        except asyncio.CancelledError:
            pass
        _sweeper_task = None


# ---------- Health ----------

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": "sqlite"}


@app.get("/")
async def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy", "database": settings.DATABASE_URL.split("://")[0]}



# # backend/app/main.py
# """
# ZKAttend Phase 2A - Main Application
# """
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware

# from .core.config import settings
# from .core.database import (
#     engine,
#     Base,
#     _ensure_unique_active_session_index,
# )

# # Import all models so they get registered
# from .models import (
#     Company,
#     Student,
#     Session,
#     ContinuityCheck,
#     Anomaly,
#     Internship,
#     InternshipAssignment,
#     WiFiTemplate,
#     WiFiVerification,
# )
# # Import API router
# from .api import router as api_router

# # Create database tables
# Base.metadata.create_all(bind=engine)

# # Flaw #4: enforce at most one active session per student, at the DB level.
# _ensure_unique_active_session_index()

# # Initialize app
# app = FastAPI(
#     title=settings.APP_NAME,
#     version=settings.APP_VERSION,
#     debug=settings.DEBUG
# )

# # CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=False,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Include API routes
# app.include_router(api_router, prefix="/api")

# @app.get("/api/health")
# async def health_check():
#     return {"status": "healthy", "database": "sqlite"}

# @app.get("/")
# async def root():
#     """Health check endpoint"""
#     return {
#         "app": settings.APP_NAME,
#         "version": settings.APP_VERSION,
#         "status": "running"
#     }


# @app.get("/health")
# async def health():
#     """Detailed health check"""
#     return {
#         "status": "healthy",
#         "database": settings.DATABASE_URL.split("://")[0]
#     }