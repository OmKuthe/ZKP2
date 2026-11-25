import sqlite3

conn = sqlite3.connect("v2.db")
conn.execute("PRAGMA foreign_keys=ON")

tables = conn.execute("""
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
""").fetchall()

for (table,) in tables:
    count = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    columns = [row[1] for row in conn.execute(f'PRAGMA table_info("{table}")')]
    print(f"\n{table}: {count} rows")
    print("  Columns:", ", ".join(columns))

conn.close()
