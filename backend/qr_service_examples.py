"""
QR Service Integration Examples and Testing
Demonstrates how to use the QRService in different contexts
"""

# ============================================================================
# Example 1: Direct Service Usage (Non-FastAPI)
# ============================================================================

import asyncio
from app.services import QRService


async def example_direct_usage():
    """Direct usage of QRService without FastAPI"""
    
    # Initialize service
    qr_service = QRService(
        redis_client=None,  # Uses in-memory storage in this example
        master_secret="your-secret-key"
    )
    
    # Generate a challenge
    challenge = await qr_service.generate_challenge(
        student_id="STU001",
        company_id=1
    )
    print(f"Generated challenge: {challenge}")
    # Output:
    # student_id='STU001'
    # company_id=1
    # token='a1b2c3d4e5f6...'
    # timestamp='2024-07-17T10:30:00Z'
    # expires_at='2024-07-17T10:30:30Z'
    # challenge_id='STU001:1:...'
    
    # Get current challenge (cached if not expired)
    current = await qr_service.get_current_challenge(
        student_id="STU001",
        company_id=1
    )
    print(f"Current challenge: {current}")
    
    # Verify a token
    result = await qr_service.verify_challenge(
        token=challenge.token,
        student_id="STU001",
        company_id=1
    )
    print(f"Verification result: {result}")
    # Output:
    # {
    #     "valid": True,
    #     "student_id": "STU001",
    #     "company_id": 1,
    #     "message": "Token verified successfully",
    #     "timestamp": "2024-07-17T10:30:05Z"
    # }
    
    # Try to use the same token again (replay attack prevention)
    result2 = await qr_service.verify_challenge(
        token=challenge.token,
        student_id="STU001",
        company_id=1
    )
    print(f"Replay attempt result: {result2}")
    # Output:
    # {
    #     "valid": False,
    #     "student_id": "STU001",
    #     "company_id": 1,
    #     "message": "Token has already been used (replay attack detected)",
    #     "timestamp": "2024-07-17T10:30:05Z"
    # }
    
    # Get QR payload for QR code generation
    payload = await qr_service.get_qr_payload(
        student_id="STU001",
        company_id=1
    )
    print(f"QR Payload (for encoding): {payload}")
    # Output:
    # {
    #     "student_id": "STU001",
    #     "company_id": 1,
    #     "token": "a1b2c3d4e5f6...",
    #     "timestamp": 1721219400,
    #     "expires_at": 1721219430
    # }


# ============================================================================
# Example 2: FastAPI Route Usage
# ============================================================================

"""
Usage in FastAPI routes:

from fastapi import APIRouter, Depends
from app.services import QRService, get_qr_service

router = APIRouter()

@router.get("/qr/challenge")
async def get_qr(qr_service: QRService = Depends(get_qr_service)):
    challenge = await qr_service.generate_challenge(
        student_id="STU001",
        company_id=1
    )
    return challenge

@router.post("/qr/verify")
async def verify_qr(
    token: str,
    qr_service: QRService = Depends(get_qr_service)
):
    result = await qr_service.verify_challenge(
        token=token,
        student_id="STU001",
        company_id=1
    )
    return result
"""


# ============================================================================
# Example 3: With Redis Connection
# ============================================================================

"""
To use with Redis (production), update your .env:

REDIS_URL=redis://localhost:6379/0
QR_MASTER_SECRET=your-production-secret-key-here
QR_CHALLENGE_TTL=30

Then the QRService will automatically use Redis for storage instead of
in-memory storage.
"""


# ============================================================================
# Example 4: Manual Redis Initialization
# ============================================================================

async def example_with_redis():
    """Initialize QRService with explicit Redis client"""
    try:
        import redis.asyncio as redis
        
        # Create Redis connection
        redis_client = await redis.from_url(
            "redis://localhost:6379/0",
            encoding="utf8",
            decode_responses=True
        )
        
        # Initialize service with Redis
        qr_service = QRService(
            redis_client=redis_client,
            master_secret="production-secret"
        )
        
        # Use service as normal
        challenge = await qr_service.generate_challenge(
            student_id="STU001",
            company_id=1
        )
        print(f"Challenge stored in Redis: {challenge}")
        
        # Clean up
        await redis_client.close()
        
    except ImportError:
        print("Redis not installed. Install with: pip install redis")


# ============================================================================
# Example 5: QR Code Generation
# ============================================================================

"""
To generate actual QR codes from the payload:

from qrcode import QRCode
import json

async def generate_qr_code(qr_service: QRService, student_id: str, company_id: int):
    # Get payload
    payload = await qr_service.get_qr_payload(student_id, company_id)
    
    # Convert to JSON string
    qr_data = json.dumps(payload.model_dump())
    
    # Generate QR code
    qr = QRCode(
        version=1,  # Can be adjusted based on payload size
        error_correction='H',
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(f"qr_{student_id}_{company_id}.png")
"""


# ============================================================================
# Example 6: TOTP Rotation (30-second windows)
# ============================================================================

"""
The QRService generates TOTP-style tokens that change every 30 seconds:

Time Window 0 (0-30s):   token = HMAC(secret, "STU001:1:0")
Time Window 1 (30-60s):  token = HMAC(secret, "STU001:1:1")
Time Window 2 (60-90s):  token = HMAC(secret, "STU001:1:2")
etc.

Verification accepts:
- Current time window
- Previous time window (for network delay tolerance)

This ensures:
✓ Tokens are unique every 30 seconds
✓ Deterministic (same token for same student/company in same window)
✓ Time-bound (expire after 30 seconds)
✓ Replay attack prevention (tokens marked as used)
✓ No database lookup needed (HMAC validation only)
"""


# ============================================================================
# Example 7: Testing Replay Attack Prevention
# ============================================================================

async def example_replay_prevention():
    """Demonstrate replay attack prevention"""
    qr_service = QRService()
    
    # Generate challenge
    challenge = await qr_service.generate_challenge("STU001", 1)
    token = challenge.token
    
    # First verification: SUCCESS
    result1 = await qr_service.verify_challenge(token, "STU001", 1)
    assert result1["valid"] is True
    print("✓ First verification successful")
    
    # Replay attempt: BLOCKED
    result2 = await qr_service.verify_challenge(token, "STU001", 1)
    assert result2["valid"] is False
    assert "replay" in result2["message"].lower()
    print("✓ Replay attack detected and prevented")


# ============================================================================
# Main Test Runner
# ============================================================================

if __name__ == "__main__":
    # Test basic functionality
    asyncio.run(example_direct_usage())
    asyncio.run(example_replay_prevention())
    print("\n✅ All examples completed successfully")
