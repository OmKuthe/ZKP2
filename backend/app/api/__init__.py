from fastapi import APIRouter
from .routes import (
    qr_router,
    admin_router,
    auth_router,
    internships_router,
    student_router,
    manager_router,
)

router = APIRouter()
router.include_router(qr_router)
router.include_router(admin_router)
router.include_router(auth_router)
router.include_router(internships_router)
router.include_router(student_router)
router.include_router(manager_router)  

__all__ = ["router"]