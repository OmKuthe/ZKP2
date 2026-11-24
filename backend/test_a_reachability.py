import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    "http://localhost:8001/api/v2/challenges/999999/respond",
    data=json.dumps({"passed": True}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    r = urllib.request.urlopen(req)
    print(f"Status: {r.status}")
    print(f"Body: {r.read().decode()}")
except urllib.error.HTTPError as e:
    print(f"Status: {e.code}")
    print(f"Body: {e.read().decode()}")
