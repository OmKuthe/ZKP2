# backend/seed_db.py
"""
Seed database with test data
Run: python seed_db.py
"""
from app.core.database import SessionLocal
from app.models import Company, Student
import bcrypt

def seed_database():
    """Add test data to database"""
    db = SessionLocal()
    
    try:
        print("🌱 Seeding database...")
        
        # 1. Check if company exists
        company = db.query(Company).filter(Company.name == "TCS Pune").first()
        
        if not company:
            # Create company if it doesn't exist
            company = Company(
                name="TCS Pune",
                geofence_center_lat=18.5204,
                geofence_center_lng=73.8567,
                geofence_radius=2.0,
                qr_master_secret="tcs-secret-123"
            )
            db.add(company)
            db.commit()
            db.refresh(company)
            print(f"✅ Created Company: {company.name} (ID: {company.id})")
        else:
            print(f"✅ Company already exists: {company.name} (ID: {company.id})")
        
        # 2. Check if students already exist
        existing_students = db.query(Student).filter(Student.company_id == company.id).count()
        if existing_students > 0:
            print(f"⚠️  {existing_students} students already exist. Skipping student creation.")
            print("\n📊 Database already has data!")
            print(f"   Company: {company.name}")
            print(f"   Students: {existing_students}")
            return
        
        # 3. Create students
        students_data = [
            {"student_id": "STU001", "name": "Om Kuthe", "email": "om@example.com", "password": "password123"},
            {"student_id": "STU002", "name": "Rahul Sharma", "email": "rahul@example.com", "password": "password123"},
            {"student_id": "STU003", "name": "Priya Patel", "email": "priya@example.com", "password": "password123"},
        ]
        
        created_students = []
        for data in students_data:
            # Hash password
            hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt())
            
            student = Student(
                student_id=data["student_id"],
                name=data["name"],
                email=data["email"],
                password_hash=hashed.decode(),
                company_id=company.id
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            created_students.append(student)
            print(f"✅ Created Student: {student.name} ({student.student_id})")
        
        print("\n📊 Database seeded successfully!")
        print(f"   Company: {company.name}")
        print(f"   Students: {len(created_students)}")
        print("\n🔑 Test Credentials:")
        print("   Email: om@example.com / Password: password123")
        print("   Email: rahul@example.com / Password: password123")
        print("   Email: priya@example.com / Password: password123")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()