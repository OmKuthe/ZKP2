# backend/app/services/qr_service.py
"""
QR Challenge Service for Phase 2
Generates TOTP-style QR challenges with HMAC-SHA256 tokens
Stores challenges in Redis with 30-second TTL
Prevents replay attacks by tracking used tokens
"""
import redis
import hmac
import hashlib
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel
import os
from dotenv import load_dotenv

# ==================== Pydantic Models (DEFINED FIRST) ====================

class QRChallenge(BaseModel):
    """Response model for QR challenges"""
    student_id: str
    company_id: int
    token: str
    timestamp: str
    expires_at: str
    challenge_id: Optional[str] = None


class QRPayload(BaseModel):
    """Payload data for QR code generation"""
    student_id: str
    company_id: int
    token: str
    timestamp: int
    expires_at: int


# ==================== Redis / Memory Setup ====================

_memory_store = {}
_used_tokens = set()

# Optional Redis support (falls back to in-memory for development)
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    # In-memory fallback
    _memory_store = {}
    _used_tokens = set()

load_dotenv()


# ==================== QR Service Class ====================

class QRService:
    """
    Service for generating, storing, and verifying QR challenges.
    Uses HMAC-SHA256 with master_secret for token generation.
    Stores challenges in Redis with 30-second TTL.
    Prevents replay attacks by tracking used tokens.
    """

    def __init__(self, redis_client: Optional[redis.Redis] = None, master_secret: Optional[str] = None):
        """
        Initialize QR Service
        
        Args:
            redis_client: Redis client instance (optional, uses in-memory fallback if not provided)
            master_secret: Master secret for HMAC generation (from environment or config)
        """
        self.redis_client = redis_client
        self.master_secret = master_secret or os.getenv("QR_MASTER_SECRET", "default-master-secret-change-in-prod")
        self.challenge_ttl = 30  # 30 seconds
        self.challenge_key_prefix = "qr_challenge:"
        self.token_used_prefix = "qr_token_used:"

    async def generate_challenge(
        self,
        student_id: str,
        company_id: int,
        internship_id: Optional[int] = None
    ) -> QRChallenge:
        """
        Generate a new TOTP-style QR challenge with 30-second expiry.
        
        Uses HMAC-SHA256 with master_secret and current time window to create
        a unique, deterministic token that changes every 30 seconds.
        """
        now = datetime.now(timezone.utc)
        timestamp = int(now.timestamp())
        time_window = timestamp // self.challenge_ttl
        
        # Create HMAC-SHA256 token
        message = f"{student_id}:{company_id}:{time_window}".encode()
        token = hmac.new(
            self.master_secret.encode(),
            message,
            hashlib.sha256
        ).hexdigest()[:32]
        
        # Calculate expiry
        expires_at = now + timedelta(seconds=self.challenge_ttl)
        
        # Create challenge record
        challenge = QRChallenge(
            student_id=student_id,
            company_id=company_id,
            token=token,
            timestamp=now.isoformat(),
            expires_at=expires_at.isoformat(),
            challenge_id=f"{student_id}:{company_id}:{time_window}"
        )
        
        # Store challenge in Redis/memory
        await self._store_challenge(challenge)
        
        return challenge

    async def verify_challenge(
        self,
        token: str,
        student_id: str,
        company_id: int,
        timestamp: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Verify a QR challenge token and prevent replay attacks.
        
        Returns:
            Dict with: valid, student_id, company_id, message, timestamp
        """
        # Check if token was already used (replay attack prevention)
        token_used_key = f"{self.token_used_prefix}{token}"
        if await self._is_token_used(token_used_key):
            return {
                "valid": False,
                "student_id": student_id,
                "company_id": company_id,
                "message": "Token has already been used (replay attack detected)",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Get current time window
        now = datetime.now(timezone.utc)
        current_timestamp = int(now.timestamp())
        time_window = current_timestamp // self.challenge_ttl
        
        # Allow current and previous time window (tolerance for network delay)
        valid_time_windows = [time_window - 1, time_window]
        
        # Verify token against valid windows
        token_valid = False
        for valid_window in valid_time_windows:
            message = f"{student_id}:{company_id}:{valid_window}".encode()
            expected_token = hmac.new(
                self.master_secret.encode(),
                message,
                hashlib.sha256
            ).hexdigest()[:32]
            
            if hmac.compare_digest(token, expected_token):
                token_valid = True
                break
        
        if not token_valid:
            return {
                "valid": False,
                "student_id": student_id,
                "company_id": company_id,
                "message": "Invalid token",
                "timestamp": now.isoformat()
            }
        
        # Mark token as used to prevent replay
        await self._mark_token_used(token_used_key)
        
        return {
            "valid": True,
            "student_id": student_id,
            "company_id": company_id,
            "message": "Token verified successfully",
            "timestamp": now.isoformat()
        }

    async def get_current_challenge(
        self,
        student_id: str,
        company_id: int
    ) -> QRChallenge:
        """
        Get the current valid challenge for a student-company pair.
        Returns existing challenge if still valid, generates new one if expired.
        """
        now = datetime.now(timezone.utc)
        timestamp = int(now.timestamp())
        time_window = timestamp // self.challenge_ttl
        challenge_id = f"{student_id}:{company_id}:{time_window}"
        
        # Try to get existing challenge from cache
        existing = await self._get_challenge(challenge_id)
        if existing:
            # Check if still valid
            expires_at = datetime.fromisoformat(existing.expires_at.replace('Z', '+00:00'))
            if expires_at > now:
                return existing
        
        # Generate new challenge if not found or expired
        return await self.generate_challenge(student_id, company_id)

    async def get_qr_payload(
        self,
        student_id: str,
        company_id: int,
        internship_id: Optional[int] = None
    ) -> QRPayload:
        """
        Get QR payload ready for QR code generation.
        """
        challenge = await self.get_current_challenge(student_id, company_id)
        now = datetime.now(timezone.utc)
        
        return QRPayload(
            student_id=challenge.student_id,
            company_id=challenge.company_id,
            token=challenge.token,
            timestamp=int(now.timestamp()),
            expires_at=int((now + timedelta(seconds=self.challenge_ttl)).timestamp())
        )

    async def mark_challenge_used(
        self,
        student_id: str,
        company_id: int,
        token: str
    ) -> bool:
        """Explicitly mark a challenge as used."""
        used_key = f"qr_used:{student_id}:{company_id}:{token}"
        return await self._mark_token_used(used_key)

    # ==================== Private Methods ====================

    async def _store_challenge(self, challenge: QRChallenge) -> None:
        """Store challenge in Redis or memory"""
        challenge_data = challenge.model_dump_json()
        
        if REDIS_AVAILABLE and self.redis_client:
            try:
                await self.redis_client.setex(
                    f"{self.challenge_key_prefix}{challenge.challenge_id}",
                    self.challenge_ttl,
                    challenge_data
                )
            except Exception as e:
                print(f"Redis error storing challenge: {e}, falling back to memory")
                _memory_store[challenge.challenge_id] = (challenge, time.time() + self.challenge_ttl)
        else:
            # In-memory fallback
            _memory_store[challenge.challenge_id] = (challenge, time.time() + self.challenge_ttl)

    async def _get_challenge(self, challenge_id: str) -> Optional[QRChallenge]:
        """Retrieve challenge from Redis or memory"""
        if REDIS_AVAILABLE and self.redis_client:
            try:
                data = await self.redis_client.get(f"{self.challenge_key_prefix}{challenge_id}")
                if data:
                    return QRChallenge.model_validate_json(data)
            except Exception as e:
                print(f"Redis error retrieving challenge: {e}, falling back to memory")
        
        # In-memory fallback
        if challenge_id in _memory_store:
            challenge, expiry = _memory_store[challenge_id]
            if time.time() < expiry:
                return challenge
            else:
                del _memory_store[challenge_id]
        
        return None

    async def _is_token_used(self, token_key: str) -> bool:
        """Check if token has been used (replay prevention)"""
        if REDIS_AVAILABLE and self.redis_client:
            try:
                exists = await self.redis_client.exists(token_key)
                return exists > 0
            except Exception as e:
                print(f"Redis error checking token: {e}, falling back to memory")
        
        # In-memory fallback
        return token_key in _used_tokens

    async def _mark_token_used(self, token_key: str) -> bool:
        """Mark token as used and set expiry"""
        if REDIS_AVAILABLE and self.redis_client:
            try:
                await self.redis_client.setex(token_key, self.challenge_ttl * 2, "1")
                return True
            except Exception as e:
                print(f"Redis error marking token: {e}, falling back to memory")
        
        # In-memory fallback
        _used_tokens.add(token_key)
        return True


# ==================== FastAPI Dependency Injection Helpers ====================

async def get_qr_service(master_secret: Optional[str] = None) -> QRService:
    """
    FastAPI dependency for injecting QRService
    
    Usage in route:
        @app.get("/qr/challenge")
        async def get_challenge(qr_service: QRService = Depends(get_qr_service)):
            ...
    """
    redis_client = None
    if REDIS_AVAILABLE:
        try:
            redis_client = await redis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379/0"),
                encoding="utf8",
                decode_responses=True
            )
        except Exception as e:
            print(f"Could not connect to Redis: {e}, using in-memory storage")
    
    return QRService(redis_client=redis_client, master_secret=master_secret)