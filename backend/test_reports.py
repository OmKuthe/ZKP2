import urllib.request, json, os

BASE = "http://localhost:8001"

# Login
login_req = urllib.request.Request(
    f"{BASE}/api/auth/login",
    data=json.dumps({"username": "admin", "password": "admin@123"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(login_req) as r:
    token = json.loads(r.read().decode())["access_token"]
print("LOGIN OK")

# Test 1: student sessions CSV
req = urllib.request.Request(
    f"{BASE}/api/v2/reports/student/S001/sessions.csv",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req) as r:
    print("\n=== STUDENT CSV ===")
    print("Status:", r.status)
    print("Content-Type:", r.headers.get("Content-Type"))
    print("Content-Disposition:", r.headers.get("Content-Disposition"))
    body = r.read().decode()
    print("First 5 lines:")
    for line in body.split("\n")[:5]:
        print(" ", line)
    print("Total lines:", len(body.split("\n")) - 1)

# Test 2: internship attendance CSV (use internship 1 — adjust if needed)
req = urllib.request.Request(
    f"{BASE}/api/v2/reports/internship/1/attendance.csv",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req) as r:
        print("\n=== INTERNSHIP CSV ===")
        print("Status:", r.status)
        print("Content-Type:", r.headers.get("Content-Type"))
        print("Content-Disposition:", r.headers.get("Content-Disposition"))
        body = r.read().decode()
        print("First 3 lines:")
        for line in body.split("\n")[:3]:
            print(" ", line)
        print("Total lines:", len(body.split("\n")) - 1)
except urllib.error.HTTPError as e:
    print("ERROR:", e.code, e.read().decode())
