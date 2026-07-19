# backend/app/api/__init__.py
from fastapi import APIRouter
from .routes import router as qr_router

# ✅ Create main router
router = APIRouter()

# ✅ Include QR router with prefix
router.include_router(qr_router, prefix="/session", tags=["session"])