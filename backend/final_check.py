import sqlite3
c = sqlite3.connect("v2.db").cursor()
print("=== Final V2 DB state ===")
for label, sql in [
    ("sessions by status",     "SELECT status, COUNT(*) FROM sessions GROUP BY 1"),
    ("test sessions remaining","SELECT COUNT(*) FROM sessions WHERE session_id LIKE 'session_test_%'"),
    ("challenges remaining",   "SELECT COUNT(*) FROM presence_challenges"),
    ("anomalies remaining",    "SELECT COUNT(*) FROM anomalies"),
]:
    print(f"\n{label}:")
    for r in c.execute(sql).fetchall():
        print(" ", r)
