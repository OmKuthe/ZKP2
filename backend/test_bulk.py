import urllib.request, json, uuid

BASE = "http://localhost:8001"
token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzk0MDAwMDAwfQ.ignore"  # ← REPLACE with real token

# First, get a real token via login
login_req = urllib.request.Request(
    f"{BASE}/api/auth/login",
    data=json.dumps({"username": "admin", "password": "admin@123"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(login_req) as r:
    token = json.loads(r.read().decode())["access_token"]
    print("LOGIN OK, token length:", len(token))

# Build a small test CSV
test_sid = "BULK" + uuid.uuid4().hex[:6].upper()
csv_content = (
    "student_id,name,email,password\n"
    f"{test_sid},Bulk Test User,{test_sid.lower()}@test.com,ignored123\n"
    "S001,Duplicate Student,existing@test.com,ignored123\n"
    ",Missing Id User,missing@test.com,ignored123\n"
    f"BAD{uuid.uuid4().hex[:4].upper()},Bad Email,bad-email-no-at,ignored123\n"
)
print("CSV content:")
print(csv_content)

# Build multipart/form-data manually (urllib doesn't do it natively)
boundary = "----boundary" + uuid.uuid4().hex
body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test.csv"\r\n'
    f"Content-Type: text/csv\r\n\r\n"
    f"{csv_content}\r\n"
    f"--{boundary}--\r\n"
).encode()

req = urllib.request.Request(
    f"{BASE}/api/v2/students/bulk",
    data=body,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req) as r:
        print("\nSTATUS:", r.status)
        print("RESPONSE:", json.dumps(json.loads(r.read().decode()), indent=2))
except urllib.error.HTTPError as e:
    print("\nERROR:", e.code)
    print(e.read().decode())
