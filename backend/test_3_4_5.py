import urllib.request, urllib.error, json

BASE = "http://localhost:8001"

def get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=10) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# 3) session detail
s, body = get("/api/v2/students/S001/sessions?limit=1")
data = json.loads(body)
sid = data["sessions"][0]["session_id"]
print(f"=== TEST 3: /api/v2/sessions/{sid} ===")
s, body = get(f"/api/v2/sessions/{sid}")
print(f"Status: {s}")
if s == 200:
    d = json.loads(body)
    print(f"  events: {len(d.get('events', []))}")
    print(f"  heartbeats: {len(d.get('heartbeats', []))}")
    print(f"  anomalies: {len(d.get('anomalies', []))}")
    print(f"  challenges: {len(d.get('challenges', []))}")
    if d.get("events"):
        print(f"  first 3 events:")
        for e in d["events"][:3]:
            print(f"    {e['layer']}/{e['event_type']} @ {e['occurred_at']}")
else:
    print(f"  body: {body[:800]}")

# 4) anomalies
print(f"\n=== TEST 4: /api/v2/anomalies ===")
s, body = get("/api/v2/anomalies")
print(f"Status: {s}")
if s == 200:
    d = json.loads(body)
    print(f"  total: {d.get('total')}")
    print(f"  anomalies: {len(d.get('anomalies', []))}")
else:
    print(f"  body: {body[:800]}")

# 5) analytics
print(f"\n=== TEST 5: /api/v2/analytics/summary ===")
s, body = get("/api/v2/analytics/summary?from=2026-01-01&to=2026-12-31")
print(f"Status: {s}")
if s == 200:
    d = json.loads(body)
    print(f"  total_sessions: {d.get('total_sessions')}")
    print(f"  verified_sessions: {d.get('verified_sessions')}")
    print(f"  flagged_sessions: {d.get('flagged_sessions')}")
    print(f"  attendance_rate: {d.get('attendance_rate')}")
    print(f"  anomaly_count_by_severity: {d.get('anomaly_count_by_severity')}")
    print(f"  layer_success_rates:")
    for r in d.get("layer_success_rates", []):
        print(f"    {r}")
else:
    print(f"  body: {body[:800]}")
