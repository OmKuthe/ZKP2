# backend/app/api/routes/__init__.py
from .qr import router as qr_router
from .admin import router as admin_router
from .auth import router as auth_router
from .internships import router as internships_router
from .student import router as student_router
from .manager import router as manager_router
from .zk import router as zk_router
from .wifi import router as wifi_router
from .v2_devices import router as v2_devices_router
from .v2_read import router as v2_read_router
from .v2_challenges import router as v2_challenges_router
from .v2_bulk import router as v2_bulk_router
from .v2_reports import router as v2_reports_router  # Phase 3.3

__all__ = [
    "qr_router",
    "admin_router",
    "auth_router",
    "internships_router",
    "student_router",
    "manager_router",
    "zk_router",
    "wifi_router",
    "v2_devices_router",
    "v2_read_router",
    "v2_challenges_router",
    "v2_bulk_router",
    "v2_reports_router",
]