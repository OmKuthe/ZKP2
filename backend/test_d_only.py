"""Test D only — explicit fail. Closes any lingering test sessions first."""
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

# 0. Close any lingering active test sessions
db = sqlite3.connect("v2.db")
db.execute("UPDATE sessions SET status = 'closed' WHERE session_id LIKE 'session_test_%' AND status = 'active'")
db.commit()
db.close()

# 1. Create a fresh active session
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
sess_v1_id = c.lastrowid
db.close()
print(f"TEST_SID={sid} (v1 id={sess_v1_id})")

# 2. Enroll 6-AP valid template
good_aps = [
    {"bssid": "AA:BB:CC:DD:EE:0%d" % i, "rssi": -45 - 5 * i, "frequency": 2412, "capabilities": "WPA2"}
    for i in range(1, 7)
]
s, b = post("/api/wifi/enroll", {"session_id": sid, "scans": [good_aps]})
print(f"ENROLL: is_valid={b.get('is_valid')} ap_count={b.get('ap_count')}")

# 3. Two failing verifies to trigger challenge
bad_scan = [
    {"bssid": "XX:XX:XX:XX:XX:01", "rssi": -45, "frequency": 2412, "capabilities": "WPA2"},
    {"bssid": "XX:XX:XX:XX:XX:02", "rssi": -50, "frequency": 2412, "capabilities": "WPA2"},
]
post("/api/wifi/verify", {"session_id": sid, "scan": bad_scan})
post("/api/wifi/verify", {"session_id": sid, "scan": bad_scan})

# 4. Get the challenge id
db = sqlite3.connect("v2.db")
cid = db.execute(
    "SELECT id FROM presence_challenges WHERE session_id = ? ORDER BY id DESC LIMIT 1",
    (sess_v1_id,),
).fetchone()
db.close()

if not cid:
    print("❌ No challenge created — wifi trigger didn't fire")
    exit(1)

cid = cid[0]
print(f"CHALLENGE_ID={cid}")

# 5. Respond with passed=false — should flag
s, b = post(f"/api/v2/challenges/{cid}/respond", {"passed": False, "note": "explicit fail test"})
print(f"RESPONSE: status={s} body={b}")

# 6. Confirm DB state
print("\n=== DB STATE ===")
db = sqlite3.connect("v2.db")
c = db.cursor()
sess = c.execute("SELECT status FROM sessions WHERE session_id = ?", (sid,)).fetchone()[0]
ch = c.execute("SELECT status, responded_at FROM presence_challenges WHERE id = ?", (cid,)).fetchone()
ev = [r[0] for r in c.execute(
    "SELECT event_type FROM verification_events WHERE session_id = ? AND event_type LIKE 'challenge%'",
    (sess_v1_id,),
).fetchall()]
an = c.execute(
    "SELECT type, severity, status FROM anomalies WHERE session_id = ?",
    (sess_v1_id,),
).fetchall()

print(f"Session status: {sess}          (expect: flagged)")
print(f"Challenge: {ch}                (expect: failed, with responded_at)")
print(f"Events: {ev}                    (expect: challenge_sent, challenge_failed)")
print(f"Anomalies: {an}                 (expect: environment_mismatch AND reverify_timeout)")
db.close()
