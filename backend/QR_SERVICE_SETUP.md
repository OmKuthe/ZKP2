# QR Service Setup Guide - Phase 2 Implementation

## Overview

The QR Service is a secure, TOTP-style challenge generation system for Phase 2 of ZKAttend. It generates rotating QR codes every 30 seconds using HMAC-SHA256, stores them in Redis (with in-memory fallback), and prevents replay attacks.

## Architecture

```
Frontend (Student App)
    ↓
GET /api/qr/payload/{company_id}
    ↓
QRService.get_qr_payload()
    ├─ Generates/retrieves 30s TOTP challenge
    └─ Returns {student_id, company_id, token, timestamp, expires_at}
    ↓
Student App encodes payload → QR Code
    ↓
Student scans company QR display
    ↓
POST /api/qr/verify/{company_id}?token=<token>
    ↓
QRService.verify_challenge()
    ├─ Checks token validity (HMAC verification)
    ├─ Prevents replay (checks used token list)
    └─ Returns success/failure
    ↓
Backend records entry/check-in event
```

## Installation

### 1. Update Dependencies

Add Redis support to `requirements.txt`:

```bash
# Add to requirements.txt
redis>=5.0.0
```

Or install directly:

```bash
cd backend
pip install redis
```

### 2. Configure Environment Variables

Add to `backend/app/.env`:

```env
# QR Service Configuration
REDIS_URL=redis://localhost:6379/0
QR_MASTER_SECRET=your-super-secret-key-change-in-production
QR_CHALLENGE_TTL=30
```

**Important:** In production, use a strong master secret (32+ characters, random):
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Start Redis (if using)

For development with Docker:
```bash
docker run -d -p 6379:6379 redis:latest
```

Or install locally and run:
```bash
redis-server
```

**Note:** If Redis is unavailable, the service automatically falls back to in-memory storage (suitable for development/testing).

## Usage

### In FastAPI Routes

```python
from fastapi import APIRouter, Depends
from app.services import QRService, get_qr_service

router = APIRouter()

@router.get("/entry")
async def entry(
    company_id: int,
    authorization: str = Header(None),
    qr_service: QRService = Depends(get_qr_service)
):
    # Get QR payload for student's app
    payload = await qr_service.get_qr_payload("STU001", company_id)
    return payload
```

### Direct Service Usage

```python
from app.services import QRService

qr_service = QRService()

# Generate challenge
challenge = await qr_service.generate_challenge("STU001", company_id=1)
print(f"Token: {challenge.token}")
print(f"Expires: {challenge.expires_at}")

# Verify token
result = await qr_service.verify_challenge(
    token=challenge.token,
    student_id="STU001",
    company_id=1
)
assert result["valid"] is True
```

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header.

### 1. Generate New Challenge
```http
GET /api/qr/challenge/{company_id}
```

**Response:**
```json
{
  "student_id": "STU001",
  "company_id": 1,
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "timestamp": "2024-07-17T10:30:00Z",
  "expires_at": "2024-07-17T10:30:30Z",
  "challenge_id": "STU001:1:123456"
}
```

### 2. Get Current Challenge (Cached)
```http
GET /api/qr/current/{company_id}
```

Returns existing challenge if valid, generates new one if expired.

### 3. Get QR Payload (Unix Timestamps)
```http
GET /api/qr/payload/{company_id}
```

**Response (for QR encoding):**
```json
{
  "student_id": "STU001",
  "company_id": 1,
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "timestamp": 1721219400,
  "expires_at": 1721219430
}
```

### 4. Verify Token
```http
POST /api/qr/verify/{company_id}?token=<token>
```

**Response:**
```json
{
  "valid": true,
  "student_id": "STU001",
  "company_id": 1,
  "message": "Token verified successfully",
  "timestamp": "2024-07-17T10:30:05Z"
}
```

### 5. Mark Challenge as Used
```http
POST /api/qr/mark-used/{company_id}?token=<token>
```

**Response:**
```json
{
  "success": true,
  "message": "QR challenge marked as used",
  "timestamp": "2024-07-17T10:30:05Z"
}
```

## Token Generation (HMAC-SHA256)

Tokens are generated deterministically using:

```python
time_window = current_timestamp // 30
token = HMAC-SHA256(
    key=master_secret,
    message=f"{student_id}:{company_id}:{time_window}"
)[:32]  # First 32 chars
```

**Properties:**
- **Deterministic:** Same student/company in same 30s window = same token
- **Time-bound:** Changes every 30 seconds
- **No database lookup:** Verification is pure HMAC computation
- **Cryptographically secure:** Uses SHA256

## Replay Attack Prevention

The service tracks used tokens and blocks reuse:

1. Token verified → marked as "used"
2. Attempt to reuse same token → rejected with "replay attack" error
3. Used token records expire after 60 seconds (2x TTL)

Example:
```python
# First verification: SUCCESS
result = await qr_service.verify_challenge(token, "STU001", 1)
assert result["valid"] is True

# Replay attempt: BLOCKED
result = await qr_service.verify_challenge(token, "STU001", 1)
assert result["valid"] is False
assert "replay" in result["message"]
```

## Time Window Tolerance

Verification accepts:
- **Current time window** (e.g., 0-30s)
- **Previous time window** (e.g., -30 to 0s for network delay)

This allows ~30-60 second verification window while maintaining security.

## Testing

Run the examples:

```bash
cd backend
python -m qr_service_examples
```

Expected output:
```
Generated challenge: student_id='STU001' company_id=1 token='...' ...
Current challenge: student_id='STU001' company_id=1 token='...' ...
Verification result: {'valid': True, 'student_id': 'STU001', ...}
Replay attempt result: {'valid': False, 'message': 'Token has already been used...'}
...
✓ First verification successful
✓ Replay attack detected and prevented

✅ All examples completed successfully
```

## Integration with Student App

The student mobile app should:

1. **On Entry:**
   ```
   GET /api/qr/payload/{company_id}
   → Receive {student_id, company_id, token, timestamp, expires_at}
   → Encode as JSON QR code
   → Display or auto-detect company QR
   ```

2. **Scan Company QR:**
   ```
   Parse company QR to get rotating token
   → Extract student_id, company_id, token
   → Generate ZK proof of knowledge (Phase 2 circuit)
   → POST /api/student/entry with proof
   ```

3. **Periodic Check-ins (Every 15-30 min):**
   ```
   GET /api/qr/payload/{company_id} (new token)
   → Generate environment commitment proof (WiFi/BLE)
   → Generate hash chain reveal
   → POST /api/student/check-in with proofs
   ```

## Troubleshooting

### Redis Connection Failed
```
SYMPTOM: "Could not connect to Redis: ConnectionError"
SOLUTION: 
- Verify Redis is running: redis-cli ping
- Check REDIS_URL in .env
- Service auto-falls back to in-memory storage
```

### Token Always Invalid
```
SYMPTOM: verify_challenge always returns valid=false
SOLUTION:
- Verify QR_MASTER_SECRET is consistent across service instances
- Check system time sync (NTP)
- Increase time window tolerance if needed
```

### Replay Prevention Too Strict
```
SYMPTOM: Can't reuse token even after 30+ seconds
SOLUTION:
- Tokens expire after 60 seconds (2x TTL)
- Generate new token with get_current_challenge()
- Tokens are TOTP-based; new token generated automatically
```

## Performance Notes

- **Token Generation:** ~1ms (HMAC-SHA256)
- **Token Verification:** ~1ms (HMAC comparison)
- **Redis Operations:** ~5-10ms per operation
- **In-Memory Storage:** <1ms (no network overhead)

For 100 concurrent students, expect <500ms response time per request.

## Security Considerations

✅ **What's Protected:**
- Tokens are HMAC-based (can't be forged)
- Replay attacks prevented
- Time-bound (30s expiry)
- Master secret is server-only (never transmitted)

⚠️ **Still Needs:**
- HTTPS transport (don't send tokens over HTTP)
- Rate limiting on /verify endpoint (prevent brute force)
- Secure master secret storage (use environment/secrets manager)
- Audit logging of verify attempts

## Next Steps for Phase 2

1. **Integrate with Entry Verification:**
   - Add QR payload to entry endpoint
   - Student scans company QR → generates ZK proof
   - Backend verifies QR token + ZK proof

2. **Session Continuity Proofs:**
   - Extend QR service to track session state
   - Generate commitment proofs with environment data
   - Periodic token rotation for continuity checks

3. **Exit Verification:**
   - Similar to entry but for session close
   - Final ZK proof + environment match

4. **Company Display Integration:**
   - Create `/display/{company_id}` route
   - Polls QR service for rotating token
   - Displays new QR every 30 seconds

## References

- [HMAC-SHA256](https://en.wikipedia.org/wiki/HMAC)
- [TOTP (Time-based One-Time Password)](https://tools.ietf.org/html/rfc6238)
- [Redis Python Async](https://redis-py.readthedocs.io/en/latest/examples/asyncio_examples.html)
- [Replay Attack Prevention](https://owasp.org/www-community/attacks/Replay_attack)
