"""
Test schemas
Run: python test_schemas.py
"""
from app.schemas import (
    QRRequest,
    QRResponse,
    EntryRequest,
    EntryResponse,
    CompanyCreate,
    CompanyResponse,
    StudentResponse,
    LoginRequest,
    SessionResponse,
)

print("=" * 50)
print("TESTING SCHEMAS")
print("=" * 50)

# 1. Test QRRequest
print("\n[1] Testing QRRequest...")
qr_req = QRRequest(student_id="STU001", company_id=1)
print(f"✅ QRRequest: student_id={qr_req.student_id}, company_id={qr_req.company_id}")

# 2. Test QRResponse
print("\n[2] Testing QRResponse...")
qr_resp = QRResponse(
    qr_data={"token": "abc123", "expires_at": 1234567890},
    expires_in=30,
    message="QR generated"
)
print(f"✅ QRResponse: message='{qr_resp.message}', expires_in={qr_resp.expires_in}s")

# 3. Test EntryRequest
print("\n[3] Testing EntryRequest...")
entry_req = EntryRequest(
    student_id="STU001",
    company_id=1,
    qr_token="abc123"
)
print(f"✅ EntryRequest: student_id={entry_req.student_id}, token={entry_req.qr_token}")

# 4. Test EntryResponse
print("\n[4] Testing EntryResponse...")
entry_resp = EntryResponse(
    session_id="session_abc123",
    message="Entry verified",
    entry_time=1234567890
)
print(f"✅ EntryResponse: session_id={entry_resp.session_id}")

# 5. Test CompanyCreate
print("\n[5] Testing CompanyCreate...")
company = CompanyCreate(
    name="TCS Pune",
    geofence_center_lat=18.5204,
    geofence_center_lng=73.8567,
    geofence_radius=2.0
)
print(f"✅ Company: {company.name}, radius={company.geofence_radius}km")

# 6. Test LoginRequest
print("\n[6] Testing LoginRequest...")
login = LoginRequest(email="om@example.com", password="secret")
print(f"✅ Login: email={login.email}")

# 7. Test SessionResponse
print("\n[7] Testing SessionResponse...")
from datetime import datetime
session = SessionResponse(
    id=1,
    session_id="session_123",
    student_id=1,
    company_id=1,
    entry_time=datetime.now(),
    status="active"
)
print(f"✅ Session: {session.session_id}, status={session.status}")

print("\n" + "=" * 50)
print("✅ ALL SCHEMA TESTS PASSED")
print("=" * 50)