import sqlite3, uuid, json, urllib.request, urllib.error
from datetime import datetime, timezone

BASE = "http://localhost:8001"

def post(path, body):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# 0. Clean up previous test sessions (all of them) so the test is idempotent
db = sqlite3.connect("v2.db")
c = db.cursor()
old_test_ids = [r[0] for r in c.execute("SELECT id FROM sessions WHERE session_id LIKE 'session_test_%'").fetchall()]
for sid_ in old_test_ids:
    c.execute("DELETE FROM verification_events WHERE session_id = ?", (sid_,))
    c.execute("DELETE FROM heartbeats WHERE session_id = ?", (sid_,))
    c.execute("DELETE FROM presence_challenges WHERE session_id = ?", (sid_,))
    c.execute("DELETE FROM anomalies WHERE session_id = ?", (sid_,))
    c.execute("DELETE FROM wifi_verifications WHERE session_id = ?", (sid_,))
    c.execute("DELETE FROM wifi_templates WHERE session_id = ?", (sid_,))
    c.execute("DELETE FROM sessions WHERE id = ?", (sid_,))
db.commit()
print(f"CLEANED {len(old_test_ids)} old test session(s)")
db.close()

# 1. Create a new test session
db = sqlite3.connect("v2.db")
c = db.cursor()
sid = "session_test_" + uuid.uuid4().hex[:8]
seed = uuid.uuid4().hex + uuid.uuid4().hex
student = c.execute("SELECT id FROM students LIMIT 1").fetchone()[0]
company = c.execute("SELECT id FROM companies LIMIT 1").fetchone()[0]
now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
c.execute(
    "INSERT INTO sessions (session_id,student_id,company_id,entry_time,hash_chain_seed,"
    "hash_counter,hash_chain_length,check_interval_seconds,status,created_at) "
    "VALUES (?,?,?,?,?,0,100,60,'active',?)",
    (sid, student, company, now, seed, now),
)
db.commit()
print(f"TEST_SID={sid}")
db.close()

# 2. Enroll a WiFi template with 6 APs (>= MIN_APS_FOR_VALID_TEMPLATE)
good_aps = [
    {"bssid": "AA:BB:CC:DD:EE:01", "rssi": -45, "frequency": 2412, "capabilities": "WPA2"},
    {"bssid": "AA:BB:CC:DD:EE:02", "rssi": -50, "frequency": 2412, "capabilities": "WPA2"},
    {"bssid": "AA:BB:CC:DD:EE:03", "rssi": -55, "frequency": 2412, "capabilities": "WPA2"},
    {"bssid": "AA:BB:CC:DD:EE:04", "rssi": -60, "frequency": 2412, "capabilities": "WPA2"},
    {"bssid": "AA:BB:CC:DD:EE:05", "rssi": -65, "frequency": 2412, "capabilities": "WPA2"},
    {"bssid": "AA:BB:CC:DD:EE:06", "rssi": -70, "frequency": 2412, "capabilities": "WPA2"},
]
s, b = post("/api/wifi/enroll", {"session_id": sid, "scans": [good_aps]})
print(f"ENROLL: status={s} success={b.get('success')} ap_count={b.get('ap_count')} is_valid={b.get('is_valid')}")
# is_valid should be True with 6 APs

# 3. Two FAILING verifies — zero BSSID overlap with template
bad_scan = [
    {"bssid": "XX:XX:XX:XX:XX:01", "rssi": -45, "frequency": 2412, "capabilities": "WPA2"},
    {"bssid": "XX:XX:XX:XX:XX:02", "rssi": -50, "frequency": 2412, "capabilities": "WPA2"},
]
s, b = post("/api/wifi/verify", {"session_id": sid, "scan": bad_scan})
print(f"FAIL1: status={s} verified={b.get('verified')} anomaly={b.get('is_anomaly')}")

s, b = post("/api/wifi/verify", {"session_id": sid, "scan": bad_scan})
print(f"FAIL2: status={s} verified={b.get('verified')} anomaly={b.get('is_anomaly')} anomaly_id={b.get('anomaly_id')}")

# 4. Inspect DB state
db = sqlite3.connect("v2.db")
c = db.cursor()
sess_v1_id = c.execute("SELECT id FROM sessions WHERE session_id = ?", (sid,)).fetchone()[0]

print("\n--- DB state after FAIL2 ---")
challenges = c.execute(
    "SELECT id, status, issued_at, expires_at FROM presence_challenges WHERE session_id = ?",
    (sess_v1_id,),
).fetchall()
print(f"CHALLENGES: {challenges}")

events = c.execute(
    "SELECT event_type, occurred_at FROM verification_events "
    "WHERE session_id = ? AND event_type LIKE 'challenge%' ORDER BY id DESC LIMIT 5",
    (sess_v1_id,),
).fetchall()
print(f"CHALLENGE_EVENTS: {events}")

anomalies = c.execute(
    "SELECT id, type, severity, status FROM anomalies WHERE session_id = ?",
    (sess_v1_id,),
).fetchall()
print(f"ANOMALIES: {anomalies}")

db.close()
