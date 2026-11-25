from pathlib import Path
from datetime import datetime, date, time, timedelta
import sqlite3
import hashlib
import json
import random
import bcrypt

DB = Path(__file__).resolve().parent / "v2.db"
PASSWORD = "Demo@12345"
rng = random.Random(20261016)

def insert(conn, table, values):
    columns = list(values.keys())
    names = ", ".join(f'"{c}"' for c in columns)
    marks = ", ".join(["?"] * len(columns))
    sql = f'INSERT INTO "{table}" ({names}) VALUES ({marks})'
    cur = conn.execute(sql, list(values.values()))
    return cur.lastrowid

def main():
    if not DB.exists():
        raise SystemExit(f"Database not found: {DB}")

    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA foreign_keys=ON")

    try:
        tables = [
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%'"
            )
        ]
        for table in tables:
            if table == "schema_migrations":
                continue
            count = conn.execute(
                f'SELECT COUNT(*) FROM "{table}"'
            ).fetchone()[0]
            if count:
                raise SystemExit(
                    f"{table} still has {count} rows. "
                    "Run reset_database.py first."
                )

        password_hash = bcrypt.hashpw(
            PASSWORD.encode(), bcrypt.gensalt()
        ).decode()

        companies_data = [
            ("Demo Nagpur Technologies", 21.1458, 79.0882),
            ("Demo Pune Technologies", 18.5204, 73.8567),
            ("Demo Yavatmal Technologies", 20.3888, 78.1204),
        ]

        with conn:
            company_ids = []
            for name, lat, lng in companies_data:
                company_ids.append(insert(conn, "companies", {
                    "name": name,
                    "geofence_center_lat": lat,
                    "geofence_center_lng": lng,
                    "geofence_radius": 1.5,
                    "qr_master_secret": hashlib.sha256(
                        (name + "-demo-secret").encode()
                    ).hexdigest(),
                    "is_active": 1,
                    "timezone": "Asia/Kolkata",
                }))

            internship_data = [
                (0, "Web Development Internship"),
                (0, "Full Stack Development Internship"),
                (1, "AI/ML Internship"),
                (2, "Cloud Computing Internship"),
            ]

            internship_ids = []
            for company_index, name in internship_data:
                internship_ids.append(insert(conn, "internships", {
                    "company_id": company_ids[company_index],
                    "name": name,
                    "description": "Synthetic demonstration internship",
                    "start_date": "2026-10-01 00:00:00",
                    "end_date": "2026-10-31 23:59:59",
                    "daily_start_time": "09:00:00",
                    "daily_end_time": "17:00:00",
                    "is_paid": 0,
                    "status": "active",
                }))

            students = []
            present_counts = {}
            absent_counts = {}

            for internship_index, (company_index, _) in enumerate(internship_data):
                for local_index in range(16):
                    number = internship_index * 16 + local_index + 1
                    prefix = ["NAG", "PUN", "YAV"][company_index]
                    sid = f"DEMO-{prefix}-{number:03d}"
                    email = f"{sid.lower()}@demo.zkattend.local"
                    full_name = f"Demo Student {number:02d}"

                    student_id = insert(conn, "students", {
                        "student_id": sid,
                        "name": full_name,
                        "email": email,
                        "company_id": company_ids[company_index],
                        "password_hash": password_hash,
                        "is_active": 1,
                    })

                    user_id = insert(conn, "users", {
                        "email": email,
                        "password_hash": password_hash,
                        "role": "student",
                        "full_name": full_name,
                    })

                    insert(conn, "student_profiles", {
                        "user_id": user_id,
                        "student_v1_id": student_id,
                    })

                    insert(conn, "internship_assignments", {
                        "internship_id": internship_ids[internship_index],
                        "student_id": student_id,
                        "is_active": 1,
                        "total_days_present": 0,
                        "total_days_absent": 0,
                    })

                    students.append({
                        "number": number,
                        "id": student_id,
                        "company_id": company_ids[company_index],
                        "internship_id": internship_ids[internship_index],
                    })
                    present_counts[student_id] = 0
                    absent_counts[student_id] = 0

            days = [date(2026, 10, 16) + timedelta(days=i) for i in range(5)]

            # 56 students attend 4 days; 8 attend all 5 days.
            # Total = 264 present days / 320 possible = 82.5%.
            anomaly_cases = {
                (2, 1), (7, 3), (19, 0),
                (34, 2), (48, 4), (61, 1)
            }

            session_count = 0
            anomaly_count = 0

            for student in students:
                index = student["number"] - 1
                missed_day = index % 5 if index < 56 else None

                for day_index, day in enumerate(days):
                    if missed_day == day_index:
                        absent_counts[student["id"]] += 1
                        continue

                    entry = datetime.combine(day, time(9, 0)) + timedelta(
                        minutes=rng.randint(0, 35)
                    )
                    exit_time = datetime.combine(day, time(17, 0)) - timedelta(
                        minutes=rng.randint(0, 25)
                    )
                    duration = int((exit_time - entry).total_seconds())
                    anomaly = (index, day_index) in anomaly_cases

                    session_code = (
                        f"DEMO-{student['number']:03d}-"
                        f"{day.strftime('%Y%m%d')}"
                    )
                    seed = hashlib.sha256(session_code.encode()).hexdigest()

                    session_id = insert(conn, "sessions", {
                        "session_id": session_code,
                        "student_id": student["id"],
                        "company_id": student["company_id"],
                        "internship_id": student["internship_id"],
                        "entry_time": entry.isoformat(sep=" "),
                        "exit_time": exit_time.isoformat(sep=" "),
                        "hash_chain_seed": seed,
                        "hash_counter": 2,
                        "hash_chain_length": 2,
                        "check_interval_seconds": 300,
                        "last_hash_check": exit_time.isoformat(sep=" "),
                        "last_wifi_score": 0.48 if anomaly else 0.94,
                        "last_wifi_check": entry.isoformat(sep=" "),
                        "wifi_fail_count": 1 if anomaly else 0,
                        "wifi_verified_count": 0 if anomaly else 1,
                        "has_wifi_template": 1,
                        "status": "flagged" if anomaly else "closed",
                        "total_duration_seconds": duration,
                        "face_verified": 1,
                        "face_verified_at": entry.isoformat(sep=" "),
                        "zkp_verified": 1,
                        "wifi_verified": 0 if anomaly else 1,
                        "chain_verified": 1,
                        "overall_verified": 0 if anomaly else 1,
                    })
                    session_count += 1

                    template_data = {
                        "aps": [
                            {"bssid": f"02:00:00:00:{index % 100:02d}:{day_index:02d}",
                             "rssi": -48, "frequency": 2412},
                            {"bssid": f"02:00:00:01:{index % 100:02d}:{day_index:02d}",
                             "rssi": -61, "frequency": 5180},
                            {"bssid": f"02:00:00:02:{index % 100:02d}:{day_index:02d}",
                             "rssi": -70, "frequency": 2437},
                        ]
                    }

                    template_id = insert(conn, "wifi_templates", {
                        "session_id": session_id,
                        "company_id": student["company_id"],
                        "student_id": student["id"],
                        "template_data": json.dumps(template_data),
                        "ap_count": 3,
                        "threshold": 0.75,
                        "rssi_tolerance": 10,
                        "status": "active",
                        "is_valid": 1,
                        "captured_at": entry.isoformat(sep=" "),
                    })

                    fingerprint = template_data if not anomaly else {
                        "aps": [
                            {"bssid": "AA:BB:CC:DD:EE:01", "rssi": -82},
                            {"bssid": "AA:BB:CC:DD:EE:02", "rssi": -79},
                        ]
                    }

                    wifi_id = insert(conn, "wifi_verifications", {
                        "session_id": session_id,
                        "template_id": template_id,
                        "student_id": student["id"],
                        "company_id": student["company_id"],
                        "fingerprint_data": json.dumps(fingerprint),
                        "ap_count": 2 if anomaly else 3,
                        "jsr_score": 0.48 if anomaly else 0.94,
                        "threshold": 0.75,
                        "rssi_tolerance": 10,
                        "is_match": 0 if anomaly else 1,
                        "is_anomaly": 1 if anomaly else 0,
                        "anomaly_reason": "Synthetic Wi-Fi mismatch" if anomaly else None,
                        "common_aps": 0 if anomaly else 3,
                        "total_aps": 2 if anomaly else 3,
                        "checked_at": (entry + timedelta(minutes=2)).isoformat(sep=" "),
                    })

                    zkp_id = insert(conn, "zkp_verifications", {
                        "session_id": session_id,
                        "purpose": "entry_geofence",
                        "valid": 1,
                        "message": "Synthetic demo proof accepted",
                        "public_signals": json.dumps({
                            "demo": True, "within_geofence": True
                        }),
                        "actual_distance": 0.12,
                        "radius": 1.5,
                        "occurred_at": entry.isoformat(sep=" "),
                    })

                    face_id = insert(conn, "face_verifications", {
                        "session_id": session_id,
                        "event_type": "verification",
                        "passed": 1,
                        "attempts": 1,
                        "occurred_at": entry.isoformat(sep=" "),
                    })

                    previous_hash = seed
                    heartbeat_ids = []
                    for sequence in (1, 2):
                        beat_time = entry + timedelta(minutes=sequence * 30)
                        current_hash = hashlib.sha256(
                            f"{previous_hash}:{session_code}:{sequence}".encode()
                        ).hexdigest()

                        heartbeat_ids.append(insert(conn, "heartbeats", {
                            "session_id": session_id,
                            "client_reported_at": beat_time.isoformat(sep=" "),
                            "server_received_at": beat_time.isoformat(sep=" "),
                            "sequence_num": sequence,
                            "hash": current_hash,
                            "prev_hash": previous_hash,
                            "valid": 1,
                            "status": "verified",
                            "message": "Synthetic demo heartbeat",
                            "environment_overlap": 1.0,
                            "proof_hash": current_hash,
                            "backfilled": 0,
                        }))
                        previous_hash = current_hash

                    events = [
                        ("zkp", "success", "zkp_verifications", zkp_id, entry),
                        ("face", "success", "face_verifications", face_id, entry),
                        ("wifi", "failure" if anomaly else "success",
                         "wifi_verifications", wifi_id, entry + timedelta(minutes=2)),
                        ("chain", "success", "heartbeats", heartbeat_ids[-1],
                         entry + timedelta(minutes=60)),
                    ]

                    for layer, event_type, source, source_id, when in events:
                        insert(conn, "verification_events", {
                            "session_id": session_id,
                            "layer": layer,
                            "event_type": event_type,
                            "occurred_at": when.isoformat(sep=" "),
                            "source_table": source,
                            "source_id": source_id,
                        })

                    if anomaly:
                        insert(conn, "anomalies", {
                            "session_id": session_id,
                            "student_id": student["id"],
                            "company_id": student["company_id"],
                            "type": "wifi_mismatch",
                            "severity": "medium",
                            "description": (
                                "Synthetic demo anomaly: Wi-Fi fingerprint "
                                "did not match the enrolled template."
                            ),
                            "resolved": 0,
                            "status": "open",
                        })
                        anomaly_count += 1

                    present_counts[student["id"]] += 1

            for student in students:
                conn.execute(
                    """UPDATE internship_assignments
                    SET total_days_present=?, total_days_absent=?
                    WHERE student_id=? AND internship_id=?""",
                    (
                        present_counts[student["id"]],
                        absent_counts[student["id"]],
                        student["id"],
                        student["internship_id"],
                    ),
                )

        violations = conn.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise RuntimeError(f"Foreign key violations: {violations[:10]}")

        present = sum(present_counts.values())
        possible = len(students) * len(days)

        print("\nDEMO DATA CREATED")
        print(f"Companies: {len(company_ids)}")
        print(f"Internships: {len(internship_ids)}")
        print(f"Students: {len(students)}")
        print(f"Sessions: {session_count}")
        print(f"Attendance: {present}/{possible} = {present/possible*100:.2f}%")
        print(f"Anomalies: {anomaly_count}")
        print(f"Dates: {days[0]} to {days[-1]}")
        print(f"Common demo password: {PASSWORD}")
        print("All records are synthetic.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
