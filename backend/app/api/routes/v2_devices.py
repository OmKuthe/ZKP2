# backend/app/api/routes/v2_devices.py
"""
V2 device registration — powers Phase 4 push notifications.

Mobile app registers its Expo push token here on login. Backend uses it
to send "Re-verify your presence" pushes when challenges are issued.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from ...models import Device, Student
from ...core.database import get_db

router = APIRouter(prefix="/v2/devices", tags=["v2-devices"])


class DeviceRegisterRequest(BaseModel):
    student_id: str
    push_token: str
    platform: str  # 'android' | 'ios'
    device_fingerprint: Optional[str] = None


class DeviceRegisterResponse(BaseModel):
    device_id: int
    message: str


@router.post("", response_model=DeviceRegisterResponse)
async def register_device(
    request: DeviceRegisterRequest,
    db: DBSession = Depends(get_db),
):
    """
    Register or update a device's push token.

    Idempotent by push_token: if the same token re-registers (e.g., after
    app reinstall on the same device), the existing row is updated rather
    than duplicated.
    """
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    existing = db.query(Device).filter(
        Device.push_token == request.push_token,
        Device.deleted_at.is_(None),
    ).first()

    if existing:
        existing.student_id = student.id
        existing.platform = request.platform
        existing.device_fingerprint = request.device_fingerprint or existing.device_fingerprint
        existing.last_seen_at = now
        db.commit()
        return DeviceRegisterResponse(device_id=existing.id, message="Device updated")

    device = Device(
        student_id=student.id,
        push_token=request.push_token,
        platform=request.platform,
        device_fingerprint=request.device_fingerprint,
        last_seen_at=now,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return DeviceRegisterResponse(device_id=device.id, message="Device registered")


@router.delete("/{device_id}")
async def unregister_device(
    device_id: int,
    db: DBSession = Depends(get_db),
):
    """
    Soft-delete a device (e.g., on logout).
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return {"message": "Device unregistered", "device_id": device_id}