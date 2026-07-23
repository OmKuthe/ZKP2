# backend/app/schemas/company.py
"""
Company schemas
"""
from pydantic import BaseModel
from typing import Optional


class CompanyCreate(BaseModel):
    """Create a new company"""
    name: str
    geofence_center_lat: float
    geofence_center_lng: float
    geofence_radius: float  # in kilometers


class CompanyResponse(BaseModel):
    """Company response"""
    id: int
    name: str
    geofence_center_lat: float
    geofence_center_lng: float
    geofence_radius: float
    is_active: bool

    class Config:
        from_attributes = True


class CompanyUpdate(BaseModel):
    """Update company"""
    name: Optional[str] = None
    geofence_center_lat: Optional[float] = None
    geofence_center_lng: Optional[float] = None
    geofence_radius: Optional[float] = None
    is_active: Optional[bool] = None

