import urllib.request, json
BASE = "http://localhost:8001"
req = urllib.request.Request(
    f"{BASE}/api/auth/login",
    data=json.dumps({"username": "admin", "password": "admin@123"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as r:
    token = json.loads(r.read().decode())["access_token"]

req = urllib.request.Request(
    f"{BASE}/api/v2/challenges/pending?student_id=S001",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req) as r:
        print(r.status, r.read().decode())
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
