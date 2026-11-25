from pathlib import Path
from datetime import datetime
import sqlite3

DB = Path(__file__).resolve().parent / "v2.db"

DELETE_ORDER = [
    "verification_events", "heartbeats", "continuity_checks",
    "wifi_verifications", "wifi_templates", "zkp_verifications",
    "face_verifications", "presence_challenges", "anomalies",
    "sessions", "student_profiles", "internship_assignments",
    "internships", "devices", "audit_log", "students", "users",
    "companies"
]

def main():
    if not DB.exists():
        raise SystemExit(f"Database not found: {DB}")

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = DB.with_name(f"v2.backup_{stamp}.db")

    conn = sqlite3.connect(DB)
    try:
        backup = sqlite3.connect(backup_path)
        try:
            conn.backup(backup)
        finally:
            backup.close()

        tables = {
            row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%'"
            )
        }

        missing = set(DELETE_ORDER) - tables
        if missing:
            raise SystemExit(f"Missing expected tables: {sorted(missing)}")

        print(f"Database: {DB}")
        print(f"Backup created: {backup_path}")
        print("\nRows to be deleted:")
        for table in DELETE_ORDER:
            count = conn.execute(
                f'SELECT COUNT(*) FROM "{table}"'
            ).fetchone()[0]
            print(f"  {table}: {count}")

        answer = input(
            '\nType exactly RESET LOCAL DEMO DB to continue: '
        ).strip()

        if answer != "RESET LOCAL DEMO DB":
            print("Cancelled. Nothing was deleted.")
            return

        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("BEGIN")
        try:
            for table in DELETE_ORDER:
                conn.execute(f'DELETE FROM "{table}"')
            conn.commit()
        except Exception:
            conn.rollback()
            raise

        violations = conn.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise RuntimeError(f"Foreign key violations: {violations[:10]}")

        print("\nReset completed.")
        print("schema_migrations and all table definitions were preserved.")
        print(f"Backup: {backup_path}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
