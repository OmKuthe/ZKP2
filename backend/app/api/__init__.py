# backend/app/api/__init__.py
from fastapi import APIRouter
from .routes import qr_router, admin_router

router = APIRouter()
router.include_router(qr_router)
router.include_router(admin_router)

__all__ = ["router"]