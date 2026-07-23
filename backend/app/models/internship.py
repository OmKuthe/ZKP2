"""
Internship model - Links companies and students
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, Time
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Internship(Base):
    __tablename__ = "internships"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # Duration
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    
    # ✅ NEW: Daily timings
    daily_start_time = Column(Time, nullable=True)  # e.g., 09:00
    daily_end_time = Column(Time, nullable=True)    # e.g., 17:00
    
    # ✅ NEW: Payment details
    is_paid = Column(Boolean, default=False)
    stipend_amount = Column(Float, nullable=True)  # Monthly stipend in INR
    
    # Status
    status = Column(String, default="active")  # active | completed | cancelled
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    company = relationship("Company", back_populates="internships")
    students = relationship("Student", secondary="internship_assignments", back_populates="internships")

    def __repr__(self):
        return f"<Internship(id={self.id}, name='{self.name}')>"