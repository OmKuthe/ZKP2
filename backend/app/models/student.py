# backend/app/models/student.py
"""
Student model - Stores student information
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True, nullable=False)  # e.g., "STU001"
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    
    # Company assignment
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    
    # Authentication
    password_hash = Column(String, nullable=False)  # For login
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    # Relationships
    company = relationship("Company", back_populates="students")
    sessions = relationship("Session", back_populates="student")

    # Add this to Student model
    internships = relationship("Internship", secondary="internship_assignments", back_populates="students")

    def __repr__(self):
        return f"<Student(id={self.id}, student_id='{self.student_id}', name='{self.name}')>"