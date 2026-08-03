# backend/reset_sessions.py
"""
Reset all active sessions
Run: python reset_sessions.py
"""
from app.core.database import SessionLocal
from app.models import Session

db = SessionLocal()

try:
    # Count active sessions
    active_count = db.query(Session).filter(Session.status == "active").count()
    print(f"📊 Found {active_count} active sessions")
    
    # Delete all active sessions
    deleted = db.query(Session).filter(Session.status == "active").delete()
    db.commit()
    
    print(f"✅ Deleted {deleted} active sessions")
    print("✅ All active sessions reset. You can now check in again.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    db.rollback()
finally:
    db.close()