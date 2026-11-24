import urllib.request, urllib.error

url = "http://localhost:8001/api/v2/students/S001/calendar?month=2026-11"
print(f"GET {url}")
try:
    with urllib.request.urlopen(url, timeout=10) as r:
        print(f"Status: {r.status}")
        print(f"Body: {r.read().decode()[:1000]}")
except urllib.error.HTTPError as e:
    print(f"Status: {e.code}")
    print(f"Body: {e.read().decode()[:2000]}")
