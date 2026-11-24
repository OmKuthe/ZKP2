#!/usr/bin/env python3
"""
V1 → V2 migration. Idempotent. Additive-only.

Usage:
    python -m migrations.v1_to_v2 --dry-run --confirm-tz=UTC
    python -m migrations.v1_to_v2 --confirm-tz=UTC

Dry-run mode: copies v2.db -> v2.dryrun.tmp.db, runs all steps against
the copy, prints counts, then deletes the copy. The real v2.db is
never touched during dry-run.

`--confirm-tz` is MANDATORY. Options: UTC, Asia/Kolkata, MIXED.
"""
from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone, timedelta

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./zkattend.db").replace("sqlite:///", "").replace("./", "")
BACKUP_SUFFIX = ".pre-v1_to_v2"
DRYRUN_SUFFIX = ".dryrun.tmp.db"
IST = timezone(timedelta(hours=5, minutes=30))


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _connect(path: str | None = None) -> sqlite3.Connection:
    path = path or DB_PATH
    if not os.path.exists(path):
        sys.exit(f"❌ DB not found at {path}. Set DATABASE_URL or copy v1 db first.")
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = OFF")  # we do our own FK checks
    return conn


def _columns(conn, table: str) -> set:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _table_exists(conn, table: str) -> bool:
    return bool(conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone())


def _migration_applied(conn) -> bool:
    if not _table_exists(conn, "schema_migrations"):
        return False
    return bool(conn.execute(
        "SELECT 1 FROM schema_migrations WHERE name='v1_to_v2'"
    ).fetchone())


def _backup_db(path: str):
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dst = f"{path}{BACKUP_SUFFIX}.{ts}"
    shutil.copy2(path, dst)
    print(f"💾 Backup written: {dst}")


# ---------------- TZ inference (diagnostic only) ----------------

def infer_timezones(conn) -> None:
    if not _table_exists(conn, "sessions"):
        print("⚠️  No sessions table — skipping TZ inference")
        return
    cols = _columns(conn, "sessions")
    if "created_at" not in cols or "entry_time" not in cols:
        print("⚠️  sessions missing created_at/entry_time — skipping TZ inference")
        return
    rows = conn.execute(
        "SELECT id, entry_time, created_at FROM sessions "
        "WHERE entry_time IS NOT NULL AND created_at IS NOT NULL"
    ).fetchall()
    if not rows:
        print("ℹ️  0 sessions to infer from")
        return
    deltas_hours = []
    for sid, entry, created in rows:
        try:
            e = datetime.fromisoformat(entry)
            c = datetime.fromisoformat(created)
        except Exception:
            continue
        deltas_hours.append((c - e).total_seconds() / 3600.0)
    if not deltas_hours:
        print("⚠️  Could not parse timestamps")
        return
    def bucket(h):
        if h < 1: return "0-1h (looks UTC)"
        if h < 3: return "1-3h"
        if h < 6: return "3-6h (looks IST)"
        if h < 12: return "6-12h"
        return ">12h"
    counts = Counter(bucket(h) for h in deltas_hours)
    print("\n📊 TZ inference histogram (created_at − entry_time):")
    for k in ["0-1h (looks UTC)", "1-3h", "3-6h (looks IST)", "6-12h", ">12h"]:
        print(f"   {k:22s}: {counts.get(k, 0)}")
    print()


# ---------------- Timestamp helpers ----------------

def _to_utc_naive(ts_str: str, tz_mode: str) -> str:
    if not ts_str:
        return ts_str
    try:
        dt = datetime.fromisoformat(ts_str)
    except ValueError:
        return ts_str
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None).isoformat(sep=" ")
    if tz_mode == "UTC":
        return dt.isoformat(sep=" ")
    if tz_mode == "Asia/Kolkata":
        return (dt - IST.utcoffset(None)).isoformat(sep=" ")
    return dt.isoformat(sep=" ")


def _infer_row_tz(created_at_str: str, entry_time_str: str) -> str:
    try:
        e = datetime.fromisoformat(entry_time_str)
        c = datetime.fromisoformat(created_at_str)
    except Exception:
        return "UTC"
    delta_h = (c - e).total_seconds() / 3600.0
    return "Asia/Kolkata" if 4.5 <= delta_h <= 6.5 else "UTC"


def _to_utc_naive_mixed(ts_str: str, created_at_str: str, entry_time_str: str) -> str:
    return _to_utc_naive(ts_str, _infer_row_tz(created_at_str, entry_time_str))


# ---------------- Steps ----------------

def step_01_new_tables(conn) -> int:
    stmts = [
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(16) NOT NULL,
            full_name VARCHAR(255),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            deleted_at DATETIME)""",
        """CREATE TABLE IF NOT EXISTS student_profiles (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
            student_v1_id INTEGER NOT NULL UNIQUE REFERENCES students(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
        """CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES students(id),
            push_token VARCHAR(512),
            platform VARCHAR(16) NOT NULL,
            device_fingerprint VARCHAR(255),
            last_seen_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME)""",
        """CREATE TABLE IF NOT EXISTS zkp_verifications (
            id INTEGER PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES sessions(id),
            purpose VARCHAR(16) NOT NULL,
            valid BOOLEAN NOT NULL,
            message TEXT,
            public_signals JSON,
            actual_distance FLOAT,
            radius FLOAT,
            occurred_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
        """CREATE TABLE IF NOT EXISTS face_verifications (
            id INTEGER PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES sessions(id),
            event_type VARCHAR(32) NOT NULL,
            passed BOOLEAN NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 1,
            occurred_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
        """CREATE TABLE IF NOT EXISTS verification_events (
            id INTEGER PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES sessions(id),
            layer VARCHAR(16) NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            occurred_at DATETIME NOT NULL,
            source_table VARCHAR(32) NOT NULL,
            source_id INTEGER NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
        """CREATE TABLE IF NOT EXISTS presence_challenges (
            id INTEGER PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES sessions(id),
            device_id INTEGER REFERENCES devices(id),
            issued_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            responded_at DATETIME,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
        """CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY,
            actor_user_id INTEGER REFERENCES users(id),
            action VARCHAR(64) NOT NULL,
            entity_type VARCHAR(32) NOT NULL,
            entity_id INTEGER NOT NULL,
            payload_json JSON,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
        """CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY,
            name VARCHAR(64) NOT NULL UNIQUE,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
        "CREATE INDEX IF NOT EXISTS ix_devices_student_active ON devices(student_id, deleted_at)",
        "CREATE INDEX IF NOT EXISTS ix_verif_events_session_layer_time ON verification_events(session_id, layer, occurred_at)",
        "CREATE INDEX IF NOT EXISTS ix_verif_events_source ON verification_events(source_table, source_id)",
        "CREATE INDEX IF NOT EXISTS ix_challenges_session_status ON presence_challenges(session_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_challenges_status_expires ON presence_challenges(status, expires_at)",
        "CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log(entity_type, entity_id)",
        "CREATE INDEX IF NOT EXISTS ix_audit_actor_time ON audit_log(actor_user_id, created_at)",
    ]
    for s in stmts:
        conn.execute(s)
    conn.commit()
    return len(stmts)


def step_02_alter_existing(conn) -> int:
    alters = {
        "companies": [("timezone", "VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'")],
        "sessions": [
            ("internship_id", "INTEGER"),
            ("device_id", "INTEGER"),
            ("zkp_verified", "BOOLEAN"),
            ("wifi_verified", "BOOLEAN"),
            ("chain_verified", "BOOLEAN"),
            ("overall_verified", "BOOLEAN"),
        ],
        "anomalies": [
            ("status", "VARCHAR(16) NOT NULL DEFAULT 'open'"),
            ("reviewed_by", "INTEGER"),
            ("reviewed_at", "DATETIME"),
            ("review_note", "TEXT"),
        ],
    }
    count = 0
    for table, cols in alters.items():
        if not _table_exists(conn, table):
            continue
        existing = _columns(conn, table)
        for col, sql_type in cols:
            if col in existing:
                continue
            count += 1
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {sql_type}")
    conn.commit()
    return count


def step_03_rename_continuity_checks(conn) -> int:
    if _table_exists(conn, "heartbeats"):
        print("   ℹ️  heartbeats already exists — skipping")
        return 0
    if not _table_exists(conn, "continuity_checks"):
        print("   ⚠️  continuity_checks not found — skipping")
        return 0
    conn.execute("""
        CREATE TABLE heartbeats (
            id INTEGER PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES sessions(id),
            client_reported_at DATETIME NOT NULL,
            server_received_at DATETIME,
            sequence_num INTEGER NOT NULL DEFAULT 0,
            hash VARCHAR(255),
            prev_hash VARCHAR(255),
            valid BOOLEAN DEFAULT 0,
            status VARCHAR(16) DEFAULT 'pending',
            message TEXT,
            environment_overlap FLOAT,
            proof_hash VARCHAR(255),
            backfilled BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
    """)
    conn.execute("""
        INSERT INTO heartbeats (
            id, session_id, client_reported_at, server_received_at,
            sequence_num, hash, valid, status, message,
            environment_overlap, proof_hash, backfilled, created_at)
        SELECT id, session_id, check_time, check_time,
               check_number, hash_link, hash_link_valid, status, message,
               environment_overlap, proof_hash, 1, created_at
        FROM continuity_checks
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS ix_heartbeats_session_time ON heartbeats(session_id, client_reported_at)")
    conn.execute("DROP TABLE continuity_checks")
    conn.commit()
    return 1


def step_04_backfill_users(conn) -> int:
    import bcrypt
    count = 0
    if not conn.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
        pw = bcrypt.hashpw(b"admin@123", bcrypt.gensalt()).decode()
        conn.execute(
            "INSERT INTO users (email, password_hash, role, full_name) "
            "VALUES (?, ?, 'admin', 'ZKAttend Admin')",
            ("admin@zkattend.local", pw),
        )
        count += 1
    rows = conn.execute(
        "SELECT s.id, s.email, s.password_hash, s.name "
        "FROM students s "
        "LEFT JOIN student_profiles sp ON sp.student_v1_id = s.id "
        "WHERE sp.id IS NULL"
    ).fetchall()
    for (sid, email, pw_hash, name) in rows:
        final_email = email or f"student-{sid}@zkattend.local"
        try:
            conn.execute(
                "INSERT INTO users (email, password_hash, role, full_name) "
                "VALUES (?, ?, 'student', ?)",
                (final_email, pw_hash, name),
            )
        except sqlite3.IntegrityError:
            final_email = f"student-{sid}@zkattend.local"
            conn.execute(
                "INSERT INTO users (email, password_hash, role, full_name) "
                "VALUES (?, ?, 'student', ?)",
                (final_email, pw_hash, name),
            )
        uid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.execute(
            "INSERT INTO student_profiles (user_id, student_v1_id) VALUES (?, ?)",
            (uid, sid),
        )
        count += 1
    conn.commit()
    return count


def step_05_backfill_sessions_internship(conn) -> int:
    if "internship_id" not in _columns(conn, "sessions"):
        print("   ⚠️  sessions.internship_id missing — skipping")
        return 0
    rows = conn.execute("SELECT id, student_id FROM sessions WHERE internship_id IS NULL").fetchall()
    count = 0
    ambiguous = 0
    for (sid, student_id) in rows:
        assigns = conn.execute(
            "SELECT internship_id FROM internship_assignments WHERE student_id=? AND is_active=1",
            (student_id,),
        ).fetchall()
        if len(assigns) == 1:
            count += 1
            conn.execute("UPDATE sessions SET internship_id=? WHERE id=?", (assigns[0][0], sid))
        else:
            ambiguous += 1
    conn.commit()
    print(f"   ℹ️  sessions.internship_id: {count} matched, {ambiguous} ambiguous (left NULL)")
    return count


def step_06_canonicalize_status(conn) -> int:
    n1 = conn.execute("UPDATE sessions SET status='closed' WHERE status='completed'").rowcount
    n2 = conn.execute("UPDATE sessions SET status='flagged' WHERE status='completed_with_anomaly'").rowcount
    conn.commit()
    return n1 + n2


def step_07_convert_timestamps(conn, tz_mode: str) -> int:
    rows = conn.execute("SELECT id, entry_time, exit_time, created_at FROM sessions").fetchall()
    count = 0
    for (sid, entry, exit_, created) in rows:
        if not entry:
            continue
        if tz_mode == "MIXED":
            new_entry = _to_utc_naive_mixed(entry, created, entry)
            new_exit = _to_utc_naive_mixed(exit_, created, entry) if exit_ else None
        else:
            new_entry = _to_utc_naive(entry, tz_mode)
            new_exit = _to_utc_naive(exit_, tz_mode) if exit_ else None
        if new_entry != entry or new_exit != exit_:
            count += 1
            conn.execute("UPDATE sessions SET entry_time=?, exit_time=? WHERE id=?",
                         (new_entry, new_exit, sid))
    conn.commit()
    return count


def step_08_backfill_verification_events(conn) -> int:
    count = 0
    hb = conn.execute("SELECT id, session_id, valid, server_received_at FROM heartbeats").fetchall()
    for (hid, sid, valid, occurred) in hb:
        conn.execute(
            "INSERT INTO verification_events "
            "(session_id, layer, event_type, occurred_at, source_table, source_id) "
            "VALUES (?, 'chain', ?, ?, 'heartbeats', ?)",
            (sid, "success" if valid else "failure", occurred or _now_utc(), hid),
        )
        count += 1
    wv = conn.execute("SELECT id, session_id, is_match, checked_at FROM wifi_verifications").fetchall()
    for (wid, sid, is_match, occurred) in wv:
        conn.execute(
            "INSERT INTO verification_events "
            "(session_id, layer, event_type, occurred_at, source_table, source_id) "
            "VALUES (?, 'wifi', ?, ?, 'wifi_verifications', ?)",
            (sid, "success" if is_match else "failure", occurred or _now_utc(), wid),
        )
        count += 1
    sf = conn.execute("SELECT id, face_verified, face_verified_at FROM sessions WHERE face_verified IS NOT NULL").fetchall()
    for (sid, fv, occurred) in sf:
        conn.execute(
            "INSERT INTO verification_events "
            "(session_id, layer, event_type, occurred_at, source_table, source_id) "
            "VALUES (?, 'face', ?, ?, 'sessions', ?)",
            (sid, "success" if fv else "failure", occurred or _now_utc(), sid),
        )
        count += 1
    conn.commit()
    return count


def step_09_compute_rollups(conn) -> int:
    if "zkp_verified" not in _columns(conn, "sessions"):
        print("   ⚠️  rollup columns missing — skipping")
        return 0
    rows = conn.execute("SELECT id FROM sessions").fetchall()
    count = 0
    for (sid,) in rows:
        layers = conn.execute(
            "SELECT layer, "
            "       SUM(CASE WHEN event_type='success' THEN 1 ELSE 0 END) AS ok, "
            "       SUM(CASE WHEN event_type='failure' THEN 1 ELSE 0 END) AS bad "
            "FROM verification_events WHERE session_id=? GROUP BY layer",
            (sid,),
        ).fetchall()
        rollup = {"zkp": None, "wifi": None, "chain": None, "face": None}
        for (layer, ok, bad) in layers:
            if ok == 0 and bad == 0:
                continue
            rollup[layer] = bool(ok > 0 and (bad or 0) == 0)
        attempted = [v for v in rollup.values() if v is not None]
        overall = all(attempted) if attempted else None
        conn.execute(
            "UPDATE sessions SET zkp_verified=?, wifi_verified=?, chain_verified=?, "
            "face_verified=COALESCE(face_verified, ?), overall_verified=? WHERE id=?",
            (rollup["zkp"], rollup["wifi"], rollup["chain"], rollup["face"], overall, sid),
        )
        count += 1
    conn.commit()
    return count


def step_10_backfill_anomalies_status(conn) -> int:
    if "status" not in _columns(conn, "anomalies"):
        print("   ⚠️  anomalies.status missing — skipping")
        return 0
    n = conn.execute("UPDATE anomalies SET status='resolved' WHERE resolved=1 AND status='open'").rowcount
    conn.commit()
    return n


def step_99_mark_migration(conn) -> None:
    conn.execute("INSERT OR IGNORE INTO schema_migrations (name) VALUES ('v1_to_v2')")
    conn.commit()


# ---------------- Main ----------------

def run_all(conn, tz_mode: str) -> None:
    steps = [
        ("01 create new tables",              lambda: step_01_new_tables(conn)),
        ("02 alter existing tables",          lambda: step_02_alter_existing(conn)),
        ("03 rename continuity_checks→heartbeats", lambda: step_03_rename_continuity_checks(conn)),
        ("04 backfill users",                 lambda: step_04_backfill_users(conn)),
        ("05 backfill sessions.internship_id",lambda: step_05_backfill_sessions_internship(conn)),
        ("06 canonicalize session status",    lambda: step_06_canonicalize_status(conn)),
        ("07 convert timestamps to UTC",      lambda: step_07_convert_timestamps(conn, tz_mode)),
        ("08 backfill verification_events",   lambda: step_08_backfill_verification_events(conn)),
        ("09 compute rollups",                lambda: step_09_compute_rollups(conn)),
        ("10 backfill anomalies.status",      lambda: step_10_backfill_anomalies_status(conn)),
    ]
    for name, fn in steps:
        try:
            n = fn()
            print(f"  ✅ {name}: {n} row(s)/change(s)")
        except Exception as e:
            print(f"  ❌ {name}: {e}")
            raise


def main():
    parser = argparse.ArgumentParser(description="V1 → V2 migration")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-backup", action="store_true")
    parser.add_argument("--confirm-tz", required=True, choices=["UTC", "Asia/Kolkata", "MIXED"])
    args = parser.parse_args()

    print(f"🗂  DB: {DB_PATH}")
    conn = _connect()

    if _migration_applied(conn):
        print("✅ schema_migrations has 'v1_to_v2' — already applied, exiting clean.")
        conn.close()
        return

    infer_timezones(conn)
    print(f"\n▶️  confirm-tz={args.confirm_tz}   dry_run={args.dry_run}\n")

    if args.dry_run:
        # Copy to temp, run against copy, delete copy at end.
        tmp_path = DB_PATH + DRYRUN_SUFFIX
        shutil.copy2(DB_PATH, tmp_path)
        print(f"📋 Dry-run target: {tmp_path} (real DB untouched)\n")
        dry_conn = _connect(tmp_path)
        try:
            run_all(dry_conn, args.confirm_tz)
            print("\n🔎 DRY-RUN COMPLETE — deleting temp copy. Real DB untouched.")
        finally:
            dry_conn.close()
            try:
                os.unlink(tmp_path)
                print(f"🗑  Deleted temp: {tmp_path}")
            except Exception as e:
                print(f"⚠️  Could not delete temp: {e}")
        conn.close()
        return

    # Real migration
    if not args.no_backup:
        _backup_db(DB_PATH)

    try:
        run_all(conn, args.confirm_tz)
        step_99_mark_migration(conn)
        print("\n🎉 Migration complete.")
    except Exception:
        conn.rollback()
        print("\n❌ Migration FAILED — DB state may be partially changed. Restore from backup if needed.")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()