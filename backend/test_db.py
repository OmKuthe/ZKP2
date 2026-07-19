# backend/test_api.py
"""
Test API Endpoints
Run: python test_api.py
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

# Test data
TEST_STUDENT_ID = "STU001"
TEST_COMPANY_ID = 1

print("=" * 60)
print("TESTING API ENDPOINTS")
print("=" * 60)

# 1. Test health
print("\n[1] Testing health endpoint...")
response = requests.get("http://localhost:8000/health")
print(f"✅ Health: {response.json()}")

# 2. Request QR (entry)
print(f"\n[2] Requesting entry QR for student {TEST_STUDENT_ID}...")
response = requests.post(
    f"{BASE_URL}/session/request-qr?purpose=entry",
    json={
        "student_id": TEST_STUDENT_ID,
        "company_id": TEST_COMPANY_ID
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"✅ QR generated: {data['qr_data']['token']}")
    print(f"   Purpose: {data['qr_data'].get('purpose', 'entry')}")
    print(f"   Expires in: {data['expires_in']}s")
    qr_token = data['qr_data']['token']
else:
    print(f"❌ Failed: {response.status_code} - {response.text}")
    exit()

# 3. Enter with QR
print(f"\n[3] Entering with QR token...")
response = requests.post(
    f"{BASE_URL}/session/entry",
    json={
        "student_id": TEST_STUDENT_ID,
        "company_id": TEST_COMPANY_ID,
        "qr_token": qr_token
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"✅ Entry successful!")
    print(f"   Session ID: {data['session_id']}")
    print(f"   Message: {data['message']}")
    session_id = data['session_id']
else:
    print(f"❌ Entry failed: {response.status_code} - {response.text}")
    exit()

# 4. Get active session
print(f"\n[4] Getting active session...")
response = requests.get(f"{BASE_URL}/session/active/{TEST_STUDENT_ID}")

if response.status_code == 200:
    data = response.json()
    if data['active']:
        print(f"✅ Active session: {data['session']['session_id']}")
        print(f"   Duration: {data['session']['duration_minutes']} minutes")
    else:
        print("❌ No active session found")
else:
    print(f"❌ Failed: {response.status_code}")

# 5. Request exit QR (with purpose=exit)
print(f"\n[5] Requesting exit QR...")
response = requests.post(
    f"{BASE_URL}/session/request-qr?purpose=exit",
    json={
        "student_id": TEST_STUDENT_ID,
        "company_id": TEST_COMPANY_ID
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"✅ Exit QR generated: {data['qr_data']['token']}")
    print(f"   Purpose: {data['qr_data'].get('purpose', 'exit')}")
    exit_qr_token = data['qr_data']['token']
else:
    print(f"❌ Failed to get exit QR: {response.status_code} - {response.text}")
    exit()

# 6. Exit
print(f"\n[6] Exiting with QR...")
response = requests.post(
    f"{BASE_URL}/session/exit",
    json={
        "session_id": session_id,
        "qr_token": exit_qr_token
    }
)

if response.status_code == 200:
    data = response.json()
    print(f"✅ Exit successful!")
    print(f"   Duration: {data['duration_seconds'] // 60} minutes")
    print(f"   Status: {data['status']}")
else:
    print(f"❌ Exit failed: {response.status_code} - {response.text}")

# 7. Get session history
print(f"\n[7] Getting session history...")
response = requests.get(f"{BASE_URL}/session/history/{TEST_STUDENT_ID}?limit=5")

if response.status_code == 200:
    data = response.json()
    print(f"✅ Found {data['total']} sessions")
    for session in data['sessions']:
        print(f"   - {session['session_id']}: {session['duration_minutes']} min")
else:
    print(f"❌ Failed: {response.status_code}")

print("\n" + "=" * 60)
print("✅ API TESTS COMPLETE")
print("=" * 60)