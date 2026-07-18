# backend/app/models/company.py
"""
Company model - Stores company information and geofence
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    
    # Geofence (reused from Phase 1)
    geofence_center_lat = Column(Float, nullable=False)
    geofence_center_lng = Column(Float, nullable=False)
    geofence_radius = Column(Float, nullable=False)  # in kilometers
    
    # QR Secret
    qr_master_secret = Column(String, nullable=False)  # Per-company QR secret
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    # Relationships
    students = relationship("Student", back_populates="company")
    sessions = relationship("Session", back_populates="company")

    def __repr__(self):
        return f"<Company(id={self.id}, name='{self.name}')>"