"""
Test database models
Run: python test_models.py
"""
from app.core.database import SessionLocal, engine, Base
from app.models import Company, Student, Session
from datetime import datetime

# Create tables
Base.metadata.create_all(bind=engine)

# Create a session
db = SessionLocal()

try:
    # 1. Create a company
    company = Company(
        name="TCS Pune",
        geofence_center_lat=18.5204,
        geofence_center_lng=73.8567,
        geofence_radius=2.0,  # 2km radius
        qr_master_secret="tcs-secret-123"
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    print(f"✅ Created Company: {company.name} (ID: {company.id})")

    # 2. Create a student
    student = Student(
        student_id="STU001",
        name="Om Kuthe",
        email="om@example.com",
        password_hash="hashed_password_here",
        company_id=company.id
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    print(f"✅ Created Student: {student.name} (ID: {student.student_id})")

    # 3. Create a session
    session = Session(
        session_id="session_abc123",
        student_id=student.id,
        company_id=company.id,
        entry_time=datetime.now(),
        status="active"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    print(f"✅ Created Session: {session.session_id} (Status: {session.status})")

    # 4. Query and show relationships
    print("\n📊 Summary:")
    print(f"   Company: {company.name}")
    print(f"   Student: {student.name} ({student.student_id})")
    print(f"   Session: {session.session_id}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    db.rollback()
finally:
    db.close()