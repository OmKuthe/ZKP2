# backend/app/api/routes/__init__.py
from .qr import router as qr_router
from .admin import router as admin_router

__all__ = ["qr_router", "admin_router"]