# backend/app/models/internship_assignment.py
"""
Internship Assignment - Links students to internships
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from ..core.database import Base

class InternshipAssignment(Base):
    __tablename__ = "internship_assignments"

    id = Column(Integer, primary_key=True, index=True)
    internship_id = Column(Integer, ForeignKey("internships.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    
    # Attendance tracking
    is_active = Column(Boolean, default=True)
    total_days_present = Column(Integer, default=0)
    total_days_absent = Column(Integer, default=0)
    
    # Metadata
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<InternshipAssignment(internship_id={self.internship_id}, student_id={self.student_id})>"