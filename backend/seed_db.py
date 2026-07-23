# backend/seed_full.py
"""
Full database seed with admin, companies, students, internships
Run: python seed_full.py
"""
from app.core.database import SessionLocal, engine, Base
from app.models import Company, Student, Internship, InternshipAssignment, Session
from datetime import datetime, timedelta
import bcrypt

def seed_database():
    """Seed complete database"""
    
    print("📊 Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created")
    
    db = SessionLocal()
    
    try:
        # Check if data already exists
        existing = db.query(Company).first()
        if existing:
            print("⚠️  Database already has data. Skipping seed.")
            return
        
        print("🌱 Seeding database...")
        
        # 1. Create companies
        companies_data = [
            {
                "name": "TCS Pune",
                "geofence_center_lat": 18.5204,
                "geofence_center_lng": 73.8567,
                "geofence_radius": 2.0,
                "qr_master_secret": "tcs-secret-123"
            },
            {
                "name": "Infosys Pune",
                "geofence_center_lat": 18.5100,
                "geofence_center_lng": 73.8700,
                "geofence_radius": 1.5,
                "qr_master_secret": "infosys-secret-456"
            }
        ]
        
        companies = []
        for data in companies_data:
            company = Company(**data)
            db.add(company)
            db.commit()
            db.refresh(company)
            companies.append(company)
            print(f"✅ Created Company: {company.name} (ID: {company.id})")
        
        # 2. Create students
        students_data = [
            {"student_id": "STU001", "name": "Om Kuthe", "email": "om@example.com", "password": "password123"},
            {"student_id": "STU002", "name": "Rahul Sharma", "email": "rahul@example.com", "password": "password123"},
            {"student_id": "STU003", "name": "Priya Patel", "email": "priya@example.com", "password": "password123"},
            {"student_id": "STU004", "name": "Amit Singh", "email": "amit@example.com", "password": "password123"},
        ]
        
        students = []
        for data in students_data:
            hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt())
            student = Student(
                student_id=data["student_id"],
                name=data["name"],
                email=data["email"],
                password_hash=hashed.decode(),
                company_id=companies[0].id  # Assign to TCS
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            students.append(student)
            print(f"✅ Created Student: {student.name} ({student.student_id})")
        
        # 3. Create internships
        internships_data = [
            {
                "company_id": companies[0].id,
                "name": "Summer Internship 2026 - TCS",
                "description": "8-week summer internship program",
                "start_date": datetime(2026, 7, 1),
                "end_date": datetime(2026, 8, 31),
                "status": "active"
            },
            {
                "company_id": companies[1].id,
                "name": "Summer Internship 2026 - Infosys",
                "description": "8-week summer internship program",
                "start_date": datetime(2026, 7, 1),
                "end_date": datetime(2026, 8, 31),
                "status": "active"
            }
        ]
        
        internships = []
        for data in internships_data:
            internship = Internship(**data)
            db.add(internship)
            db.commit()
            db.refresh(internship)
            internships.append(internship)
            print(f"✅ Created Internship: {internship.name} (ID: {internship.id})")
        
        # 4. Assign students to internships
        assignments = [
            {"internship_id": internships[0].id, "student_id": students[0].id},
            {"internship_id": internships[0].id, "student_id": students[1].id},
            {"internship_id": internships[0].id, "student_id": students[2].id},
            {"internship_id": internships[1].id, "student_id": students[3].id},
        ]
        
        for data in assignments:
            assignment = InternshipAssignment(**data)
            db.add(assignment)
            db.commit()
            db.refresh(assignment)
            print(f"✅ Assigned Student {data['student_id']} to Internship {data['internship_id']}")
        
        print("\n📊 Database seeded successfully!")
        print(f"   Companies: {len(companies)}")
        print(f"   Students: {len(students)}")
        print(f"   Internships: {len(internships)}")
        print(f"   Assignments: {len(assignments)}")
        print("\n🔑 Admin Login:")
        print("   Username: admin")
        print("   Password: admin@123")
        print("\n🔑 Student Login (ID only):")
        print("   STU001, STU002, STU003, STU004")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()