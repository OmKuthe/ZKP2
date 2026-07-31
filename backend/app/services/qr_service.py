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
import token
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from ..core.config import settings

# ❌ Remove this import for now
# from .poseidon import poseidon_hash


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
        """
        now = int(time.time())
        time_window = now // self.challenge_ttl
        
        # Include purpose in token generation
        message = f"{student_id}:{company_id}:{purpose}:{time_window}"
        token = hmac.new(
            self.master_secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        
        challenge = QRChallenge(
            student_id=student_id,
            company_id=company_id,
            token=token,
            purpose=purpose,
            timestamp=now,
            expires_at=now + self.challenge_ttl
        )
        
        self._challenges[token] = challenge
        return challenge
    
    def verify_challenge(self, token: str, student_id: str, company_id: int, purpose: Optional[str] = None) -> QRVerificationResult:
        """Verify a QR challenge token."""
        if token in self._used_tokens:
            return QRVerificationResult(valid=False, message="Token already used (replay attack detected)")
        
        challenge = self._challenges.get(token)
        if not challenge:
            return QRVerificationResult(valid=False, message="Invalid token")
        
        if challenge.student_id != student_id:
            return QRVerificationResult(valid=False, message="Token does not match student")
        
        if challenge.company_id != company_id:
            return QRVerificationResult(valid=False, message="Token does not match company")
        
        if purpose and challenge.purpose != purpose:
            return QRVerificationResult(valid=False, message=f"Token is for {challenge.purpose}, not {purpose}")
        
        now = int(time.time())
        if now > challenge.expires_at:
            return QRVerificationResult(valid=False, message="Token expired")
        
        self._used_tokens.add(token)
        return QRVerificationResult(
            valid=True,
            student_id=student_id,
            company_id=company_id,
            purpose=challenge.purpose,
            message="Token verified successfully"
        )
    
    def get_current_challenge(self, student_id: str, company_id: int, purpose: str = "entry") -> QRChallenge:
        return self.generate_challenge(student_id, company_id, purpose)
    
    def get_challenge_by_token(self, token: str) -> Optional[QRChallenge]:
        return self._challenges.get(token)
    
    def cleanup_expired(self) -> int:
        now = int(time.time())
        expired_tokens = [t for t, c in self._challenges.items() if now > c.expires_at]
        for token in expired_tokens:
            del self._challenges[token]
        return len(expired_tokens)
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_challenges": len(self._challenges),
            "used_tokens": len(self._used_tokens),
            "challenge_ttl": self.challenge_ttl
        }
        
    def _compute_commitment(self, token: str, student_id: str) -> str:
        """
        Compute commitment = token * student_id mod prime
        ✅ Properly reduces to field prime
        """
        PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617
        
        # Convert strings to integers
        token_int = 0
        for char in token:
            token_int = (token_int * 256 + ord(char)) % PRIME
        
        student_int = 0
        for char in student_id:
            student_int = (student_int * 256 + ord(char)) % PRIME
        
        # Multiply and reduce
        result = (token_int * student_int) % PRIME
        
        # 🔍 Debug
        print(f"🔍 Commitment Debug:")
        print(f"   Token: {token[:16]}...")
        print(f"   Token Int (mod): {token_int}")
        print(f"   Student Int (mod): {student_int}")
        print(f"   Result: {result}")
        
        return str(result)