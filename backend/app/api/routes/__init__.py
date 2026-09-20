# backend/app/api/routes/__init__.py
from .qr import router as qr_router
from .admin import router as admin_router
from .auth import router as auth_router
from .internships import router as internships_router
from .student import router as student_router
from .manager import router as manager_router
from .zk import router as zk_router
from .wifi import router as wifi_router   

__all__ = [
    "qr_router",
    "admin_router",
    "auth_router",
    "internships_router",
    "student_router",
    "manager_router",
    "zk_router",
    "wifi_router",   
]