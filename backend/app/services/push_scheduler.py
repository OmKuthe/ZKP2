# backend/app/services/push_scheduler.py
"""
Push Scheduler - Phase 2D
Schedules periodic verification checks
"""
import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Optional
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession
from ..models import Session as SessionModel
from ..core.database import SessionLocal


@dataclass
class ScheduledCheck:
    session_id: str
    scheduled_time: datetime
    status: str = "pending"  # pending | sent | completed


class PushScheduler:
    """
    Schedules periodic checks for active sessions.
    In production, this would send FCM/APNs pushes.
    For now, it just logs scheduled checks.
    """
    
    def __init__(self):
        self._checks: Dict[str, ScheduledCheck] = {}
        self._running = False
        self._interval_seconds = 60  # Check every minute
    
    async def start(self):
        """Start the scheduler"""
        self._running = True
        print("📡 Push Scheduler started")
        
        while self._running:
            await self._schedule_checks()
            await asyncio.sleep(self._interval_seconds)
    
    async def stop(self):
        """Stop the scheduler"""
        self._running = False
        print("📡 Push Scheduler stopped")
    
    async def _schedule_checks(self):
        """Check for sessions needing verification"""
        db = SessionLocal()
        
        try:
            # Get all active sessions
            active_sessions = db.query(SessionModel).filter(
                SessionModel.status == "active"
            ).all()
            
            now = datetime.now()
            
            for session in active_sessions:
                # Check if verification is due (every 15 minutes)
                session_time = session.entry_time.replace(tzinfo=None)
                minutes_since_entry = (now - session_time).total_seconds() / 60
                
                if minutes_since_entry < 15:
                    continue  # Wait at least 15 minutes
                
                # Schedule check every 15 minutes
                check_interval = 15  # minutes
                last_check = session.last_hash_check or session.entry_time
                minutes_since_check = (now - last_check.replace(tzinfo=None)).total_seconds() / 60
                
                if minutes_since_check >= check_interval:
                    check_id = f"{session.session_id}:{int(now.timestamp())}"
                    
                    self._checks[check_id] = ScheduledCheck(
                        session_id=session.session_id,
                        scheduled_time=now,
                        status="pending"
                    )
                    
                    # Update last check time
                    session.last_hash_check = now
                    db.commit()
                    
                    print(f"📡 Scheduled check for session: {session.session_id}")
                    
                    # 🔔 In production, send push notification here:
                    # await send_push(session.student.device_token, session.session_id)
                    
        except Exception as e:
            print(f"❌ Error in push scheduler: {e}")
        finally:
            db.close()
    
    def get_pending_checks(self) -> list:
        """Get all pending checks"""
        return [c for c in self._checks.values() if c.status == "pending"]
    
    def mark_check_sent(self, check_id: str):
        """Mark a check as sent"""
        if check_id in self._checks:
            self._checks[check_id].status = "sent"
    
    def get_stats(self) -> dict:
        """Get scheduler statistics"""
        total = len(self._checks)
        pending = len([c for c in self._checks.values() if c.status == "pending"])
        sent = len([c for c in self._checks.values() if c.status == "sent"])
        
        return {
            "total_checks": total,
            "pending": pending,
            "sent": sent,
            "running": self._running,
        }