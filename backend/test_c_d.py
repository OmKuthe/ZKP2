"""Phase 4 tests C and D — explicit pass and explicit fail."""
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

def create_session_and_challenge():
    """Creates a session, enrolls 6-AP template, fails wifi twice, returns (sid, challenge_id)."""
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

    # Enroll 6 APs
    good_aps = [
        {"bssid": "AA:BB:CC:DD:EE:0%d" % i, "rssi": -45 - 5 * i, "frequency": 2412, "capabilities": "WPA2"}
        for i in range(1, 7)
    ]
    post("/api/wifi/enroll", {"session_id": sid, "scans": [good_aps]})

    # Fail twice
    bad_scan = [
        {"bssid": "XX:XX:XX:XX:XX:01", "rssi": -45, "frequency": 2412, "capabilities": "WPA2"},
        {"bssid": "XX:XX:XX:XX:XX:02", "rssi": -50, "frequency": 2412, "capabilities": "WPA2"},
    ]
    post("/api/wifi/verify", {"session_id": sid, "scan": bad_scan})
    post("/api/wifi/verify", {"session_id": sid, "scan": bad_scan})

    # Get the pending challenge
    db = sqlite3.connect("v2.db")
    c = db.cursor()
    row = c.execute(
        "SELECT id FROM presence_challenges WHERE session_id = ? ORDER BY id DESC LIMIT 1",
        (sess_v1_id,),
    ).fetchone()
    db.close()
    return sid, (row[0] if row else None)


# ---- Test C: explicit PASS ----
print("=== TEST C: respond passed=true ===")
sid_c, cid_c = create_session_and_challenge()
print(f"  session={sid_c} challenge={cid_c}")
if cid_c:
    s, b = post(f"/api/v2/challenges/{cid_c}/respond", {"passed": True})
    print(f"  RESPONSE: status={s} body={b}")
else:
    print("  ⚠️  No challenge created — wifi trigger didn't fire")


# ---- Test D: explicit FAIL ----
print("\n=== TEST D: respond passed=false ===")
sid_d, cid_d = create_session_and_challenge()
print(f"  session={sid_d} challenge={cid_d}")
if cid_d:
    s, b = post(f"/api/v2/challenges/{cid_d}/respond", {"passed": False, "note": "explicit fail test"})
    print(f"  RESPONSE: status={s} body={b}")
else:
    print("  ⚠️  No challenge created — wifi trigger didn't fire")


# ---- Verify DB state for both ----
print("\n=== DB STATE ===")
db = sqlite3.connect("v2.db")
c = db.cursor()

for sid, label in [(sid_c, "C (passed)"), (sid_d, "D (failed)")]:
    sess = c.execute("SELECT id, status FROM sessions WHERE session_id = ?", (sid,)).fetchone()
    print(f"\n{label}: session {sess[0]} status={sess[1]}")
    ch = c.execute(
        "SELECT id, status, responded_at FROM presence_challenges WHERE session_id = ?",
        (sess[0],),
    ).fetchall()
    print(f"  challenges: {ch}")
    ev = c.execute(
        "SELECT event_type FROM verification_events WHERE session_id = ? AND event_type LIKE 'challenge%'",
        (sess[0],),
    ).fetchall()
    print(f"  events: {[r[0] for r in ev]}")
    an = c.execute(
        "SELECT id, type, severity, status FROM anomalies WHERE session_id = ?",
        (sess[0],),
    ).fetchall()
    print(f"  anomalies: {an}")

db.close()
