"""Phase 2 verification — runs all 5 endpoint tests."""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8001"

def get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=10) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def show(label, status, body, keys_to_print=None):
    print(f"\n=== {label} ===")
    print(f"  status: {status}")
    if keys_to_print:
        for k in keys_to_print:
            v = body.get(k) if isinstance(body, dict) else None
            if isinstance(v, list):
                print(f"  {k}: [{len(v)} items]")
                for item in v[:3]:
                    print(f"    {item}")
            else:
                print(f"  {k}: {v}")
    else:
        print(f"  body: {json.dumps(body, default=str)[:300]}")

# 1) sessions
s, b = get("/api/v2/students/S001/sessions?limit=3")
show("TEST 1 sessions", s, b, ["total", "page", "limit", "sessions"])

# 2) calendar
s, b = get("/api/v2/students/S001/calendar?month=2026-11")
if s == 200:
    days = b.get("days", [])
    present = [d for d in days if d.get("present")]
    print(f"\n=== TEST 2 calendar ===")
    print(f"  status: {s}")
    print(f"  total days: {len(days)}, days present: {len(present)}")
    print(f"  timezone: {b.get('timezone')}")
    print(f"  present days: {[d['day'] for d in present][:10]}")
else:
    show("TEST 2 calendar", s, b)

# 3) session detail — pick a real session id from test 1
s, b = get("/api/v2/students/S001/sessions?limit=1")
sid = b["sessions"][0]["session_id"] if b.get("sessions") else None
if sid:
    s, b = get(f"/api/v2/sessions/{sid}")
    if s == 200:
        print(f"\n=== TEST 3 session detail ({sid}) ===")
        print(f"  status: {s}")
        print(f"  events: {len(b.get('events', []))}")
        print(f"  heartbeats: {len(b.get('heartbeats', []))}")
        print(f"  anomalies: {len(b.get('anomalies', []))}")
        print(f"  challenges: {len(b.get('challenges', []))}")
        if b.get("events"):
            print(f"  first 3 events:")
            for e in b["events"][:3]:
                print(f"    {e['layer']}/{e['event_type']} @ {e['occurred_at']}")
    else:
        show(f"TEST 3 session detail ({sid})", s, b)
else:
    print("\n=== TEST 3 skipped: no sessions found ===")

# 4) anomalies
s, b = get("/api/v2/anomalies")
show("TEST 4 anomalies (all)", s, b, ["total", "anomalies"])

# 5) analytics
s, b = get("/api/v2/analytics/summary?from=2026-01-01&to=2026-12-31")
if s == 200:
    print(f"\n=== TEST 5 analytics ===")
    print(f"  total_sessions: {b.get('total_sessions')}")
    print(f"  verified_sessions: {b.get('verified_sessions')}")
    print(f"  flagged_sessions: {b.get('flagged_sessions')}")
    print(f"  attendance_rate: {b.get('attendance_rate')}")
    print(f"  anomaly_count_by_severity: {b.get('anomaly_count_by_severity')}")
    print(f"  anomaly_count_by_type: {b.get('anomaly_count_by_type')}")
    print(f"  layer_success_rates:")
    for r in b.get("layer_success_rates", []):
        print(f"    {r}")
else:
    show("TEST 5 analytics", s, b)
