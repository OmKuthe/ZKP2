import sqlite3

conn = sqlite3.connect("v2.db")

tables = [
    "companies", "students", "users", "student_profiles",
    "internships", "internship_assignments", "sessions",
    "heartbeats", "wifi_templates", "wifi_verifications",
    "verification_events", "anomalies"
]

for table in tables:
    print(f"\n{'=' * 60}")
    print(f"TABLE: {table}")
    print("COLUMNS:")
    for row in conn.execute(f'PRAGMA table_info("{table}")'):
        cid, name, col_type, notnull, default, pk = row
        print(f"  {name}: {col_type}, NOT NULL={notnull}, DEFAULT={default}, PK={pk}")

    print("FOREIGN KEYS:")
    for row in conn.execute(f'PRAGMA foreign_key_list("{table}")'):
        print(f"  {row}")

conn.close()
