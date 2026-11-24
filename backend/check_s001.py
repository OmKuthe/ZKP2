import sqlite3
db = sqlite3.connect("v2.db")
# S001's V1 id
sid = db.execute("SELECT id FROM students WHERE student_id = 'S001'").fetchone()[0]
print(f"S001 has V1 students.id = {sid}")
print()
print("Sessions by month (UTC):")
for row in db.execute(
    "SELECT strftime('%Y-%m', entry_time) AS month, COUNT(*) "
    "FROM sessions WHERE student_id = ? GROUP BY month ORDER BY month",
    (sid,)
).fetchall():
    print(f"  {row[0]}: {row[1]}")
print()
print("All S001 sessions (entry_time UTC, converted to IST):")
for row in db.execute(
    "SELECT session_id, entry_time FROM sessions "
    "WHERE student_id = ? ORDER BY entry_time DESC",
    (sid,)
).fetchall():
    from datetime import datetime, timedelta, timezone
    utc_dt = datetime.fromisoformat(row[1]).replace(tzinfo=timezone.utc)
    ist_dt = utc_dt + timedelta(hours=5, minutes=30)
    print(f"  {row[0]}  UTC={row[1]}  IST={ist_dt.strftime('%Y-%m-%d %H:%M')}")
db.close()
