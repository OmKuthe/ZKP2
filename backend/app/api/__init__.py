# backend/app/api/__init__.py
from fastapi import APIRouter

from .routes import (
    qr_router,
    admin_router,
    auth_router,
    internships_router,
    student_router,
    manager_router,
    zk_router,
    wifi_router,
    v2_devices_router,
    v2_read_router,
    v2_challenges_router,
    v2_bulk_router,
    v2_reports_router,
)

router = APIRouter()

router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(internships_router)
router.include_router(manager_router)
router.include_router(student_router)
router.include_router(qr_router)
router.include_router(zk_router)
router.include_router(wifi_router)
router.include_router(v2_devices_router)
router.include_router(v2_read_router)
router.include_router(v2_challenges_router)
router.include_router(v2_bulk_router)
router.include_router(v2_reports_router)