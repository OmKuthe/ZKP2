from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import User, Company
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def init_default_data(db: AsyncSession):
    """Initialize default admin, manager, and sample company"""
    
    # Check if admin exists
    admin_result = await db.execute(select(User).where(User.user_type == "admin"))
    admin = admin_result.scalar_one_or_none()
    
    if not admin:
        # Create default admin
        admin_user = User(
            user_id="admin",
            email="admin@zkattend.com",
            full_name="System Administrator",
            user_type="admin",
            department="Administration",
            hashed_password=pwd_context.hash("admin123"),
            is_active=True
        )
        db.add(admin_user)
        print("✅ Created default admin: admin / admin123")
    
    # Create sample company if none exists
    company_result = await db.execute(select(Company))
    companies = company_result.scalars().all()
    
    if len(companies) == 0:
        sample_company = Company(
            name="Google India",
            address="Koramangala, Bangalore",
            latitude=12.9352,
            longitude=77.6245,
            radius_meters=200,
            created_by="admin"
        )
        db.add(sample_company)
        print("✅ Created sample company: Google India")
    
    await db.commit()