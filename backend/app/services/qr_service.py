# backend/app/services/qr_service.py
"""
QR Challenge Service - Phase 2A
Generates and verifies time-based QR tokens.
Uses HMAC-SHA256 with master secret for token generation.
"""
import hmac
import hashlib
import time
import os
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from ..core.config import settings


# ==================== Models ====================

class QRChallenge(BaseModel):
    """QR challenge data"""
    student_id: str
    company_id: int
    token: str
    purpose: str  # "entry" or "exit"
    timestamp: int
    expires_at: int


class QRVerificationResult(BaseModel):
    """Result of QR verification"""
    valid: bool
    student_id: Optional[str] = None
    company_id: Optional[int] = None
    purpose: Optional[str] = None
    message: str


# ==================== Service ====================

class QRService:
    """
    Simple QR challenge service.
    Uses in-memory storage (no Redis required for development).
    """
    
    def __init__(self, master_secret: Optional[str] = None):
        self.master_secret = master_secret or settings.QR_MASTER_SECRET
        self.challenge_ttl = settings.QR_CHALLENGE_TTL  # 30 seconds
        self._challenges = {}  # In-memory storage: token -> QRChallenge
        self._used_tokens = set()  # Replay prevention: token -> used
    
    def generate_challenge(self, student_id: str, company_id: int, purpose: str = "entry") -> QRChallenge:
        """
        Generate a new QR challenge.
        
        Token = HMAC(master_secret, student_id + company_id + purpose + time_window)
        Time window = current_time // 30 (changes every 30 seconds)
        
        Args:
            student_id: Student identifier
            company_id: Company identifier
            purpose: "entry" or "exit"
            
        Returns:
            QRChallenge with token, timestamps
        """
        now = int(time.time())
        time_window = now // self.challenge_ttl
        
        # ✅ Include purpose in token generation
        message = f"{student_id}:{company_id}:{purpose}:{time_window}"
        token = hmac.new(
            self.master_secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()[:16]  # 16 chars for QR readability
        
        # Create challenge
        challenge = QRChallenge(
            student_id=student_id,
            company_id=company_id,
            token=token,
            purpose=purpose,
            timestamp=now,
            expires_at=now + self.challenge_ttl
        )
        
        # Store in memory
        self._challenges[token] = challenge
        
        return challenge
    
    def verify_challenge(self, token: str, student_id: str, company_id: int, purpose: Optional[str] = None) -> QRVerificationResult:
        """
        Verify a QR challenge token.
        
        Checks:
        1. Token is not already used (replay prevention)
        2. Token exists
        3. Token matches student/company
        4. Token matches purpose (if provided)
        5. Token is not expired
        
        Args:
            token: The QR token to verify
            student_id: Student ID from the request
            company_id: Company ID from the request
            purpose: "entry" or "exit" (optional)
            
        Returns:
            QRVerificationResult with validity and message
        """
        # 1. Check if token was already used (replay prevention)
        if token in self._used_tokens:
            return QRVerificationResult(
                valid=False,
                message="Token already used (replay attack detected)"
            )
        
        # 2. Check if token exists
        challenge = self._challenges.get(token)
        if not challenge:
            return QRVerificationResult(
                valid=False,
                message="Invalid token"
            )
        
        # 3. Check if token matches student/company
        if challenge.student_id != student_id:
            return QRVerificationResult(
                valid=False,
                message="Token does not match student"
            )
        
        if challenge.company_id != company_id:
            return QRVerificationResult(
                valid=False,
                message="Token does not match company"
            )
        
        # 4. Check if token matches purpose
        if purpose and challenge.purpose != purpose:
            return QRVerificationResult(
                valid=False,
                message=f"Token is for {challenge.purpose}, not {purpose}"
            )
        
        # 5. Check if token is expired
        now = int(time.time())
        if now > challenge.expires_at:
            return QRVerificationResult(
                valid=False,
                message="Token expired"
            )
        
        # 6. Mark as used to prevent replay
        self._used_tokens.add(token)
        
        # Optional: Clean up old used tokens (keep it small)
        if len(self._used_tokens) > 1000:
            self._used_tokens.clear()
        
        return QRVerificationResult(
            valid=True,
            student_id=student_id,
            company_id=company_id,
            purpose=challenge.purpose,
            message="Token verified successfully"
        )
    
    def get_current_challenge(self, student_id: str, company_id: int, purpose: str = "entry") -> QRChallenge:
        """
        Get the current valid challenge for a student-company pair.
        """
        return self.generate_challenge(student_id, company_id, purpose)
    
    def get_challenge_by_token(self, token: str) -> Optional[QRChallenge]:
        """Get a challenge by token (for debugging)"""
        return self._challenges.get(token)
    
    def cleanup_expired(self) -> int:
        """
        Remove expired challenges from memory.
        Returns number of removed challenges.
        """
        now = int(time.time())
        expired_tokens = [
            token for token, challenge in self._challenges.items()
            if now > challenge.expires_at
        ]
        
        for token in expired_tokens:
            del self._challenges[token]
        
        return len(expired_tokens)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get service statistics (for debugging)
        """
        return {
            "total_challenges": len(self._challenges),
            "used_tokens": len(self._used_tokens),
            "challenge_ttl": self.challenge_ttl
        }