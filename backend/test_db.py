"""
Test Phase 2B: Hash Chain
Run: python test_hash_chain.py
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

TEST_STUDENT_ID = "STU001"
TEST_COMPANY_ID = 1

print("=" * 60)
print("PHASE 2B: HASH CHAIN TEST")
print("=" * 60)

# 1. Clear any active session
print("\n[1] Checking for active session...")
resp = requests.get(f"{BASE_URL}/session/active/{TEST_STUDENT_ID}")
if resp.status_code == 200:
    data = resp.json()
    if data.get('active'):
        session_id = data['session']['session_id']
        print(f"⚠️  Active session found: {session_id}")
        # Get exit QR
        resp = requests.post(
            f"{BASE_URL}/session/request-qr?purpose=exit",
            json={"student_id": TEST_STUDENT_ID, "company_id": TEST_COMPANY_ID}
        )
        if resp.status_code == 200:
            token = resp.json()['qr_data']['token']
            resp = requests.post(
                f"{BASE_URL}/session/exit",
                json={"session_id": session_id, "qr_token": token}
            )
            print(f"✅ Cleared active session")

# 2. Get entry QR
print("\n[2] Getting entry QR...")
resp = requests.post(
    f"{BASE_URL}/session/request-qr?purpose=entry",
    json={"student_id": TEST_STUDENT_ID, "company_id": TEST_COMPANY_ID}
)
if resp.status_code != 200:
    print(f"❌ Failed: {resp.text}")
    exit()
entry_token = resp.json()['qr_data']['token']
print(f"✅ Entry QR: {entry_token}")

# 3. Entry (Phase 2B: Should return seed)
print("\n[3] Entering...")
resp = requests.post(
    f"{BASE_URL}/session/entry",
    json={
        "student_id": TEST_STUDENT_ID,
        "company_id": TEST_COMPANY_ID,
        "qr_token": entry_token
    }
)
if resp.status_code != 200:
    print(f"❌ Failed: {resp.text}")
    exit()

data = resp.json()
session_id = data['session_id']
seed = data.get('seed')
print(f"✅ Entry successful!")
print(f"   Session ID: {session_id}")
print(f"   Seed: {seed[:32]}... (truncated)")

# 4. Generate hash chain locally (simulating app)
print("\n[4] Generating hash chain...")
import hashlib

chain = []
current = seed
for i in range(10):  # Generate first 10 links
    current = hashlib.sha256(current.encode()).hexdigest()
    chain.append(current)
print(f"✅ Generated 10 links")
print(f"   h1: {chain[0][:16]}...")
print(f"   h10: {chain[9][:16]}...")

# 5. Get exit QR
print("\n[5] Getting exit QR...")
resp = requests.post(
    f"{BASE_URL}/session/request-qr?purpose=exit",
    json={"student_id": TEST_STUDENT_ID, "company_id": TEST_COMPANY_ID}
)
if resp.status_code != 200:
    print(f"❌ Failed: {resp.text}")
    exit()
exit_token = resp.json()['qr_data']['token']
print(f"✅ Exit QR: {exit_token}")

# 6. Exit with hash chain verification
print("\n[6] Exiting with hash chain verification...")
resp = requests.post(
    f"{BASE_URL}/session/exit",
    json={
        "session_id": session_id,
        "qr_token": exit_token,
        "hash_link": chain[9]  # Send final link (h10)
    }
)
if resp.status_code != 200:
    print(f"❌ Failed: {resp.text}")
    exit()

data = resp.json()
print(f"✅ Exit successful!")
print(f"   Duration: {data['duration_seconds'] // 60} minutes")
print(f"   Chain Verified: {data.get('chain_verified', False)}")

print("\n" + "=" * 60)
print("✅ PHASE 2B TEST COMPLETE")
print("=" * 60)