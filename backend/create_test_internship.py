# create_test_internship.py
import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('zkattend.db')
cursor = conn.cursor()

# Get company ID
cursor.execute("SELECT id FROM companies LIMIT 1")
company_id = cursor.fetchone()[0]

# Get manager ID
cursor.execute("SELECT manager_id FROM manager_profiles LIMIT 1")
manager_id = cursor.fetchone()[0]

# Create internship with short duration for testing
start_date = datetime.now().date()
end_date = start_date + timedelta(days=30)

cursor.execute("""
    INSERT INTO internships (
        internship_id, company_id, role_name, description, manager_id,
        start_date, end_date, daily_start_time, daily_end_time,
        lunch_break_minutes, required_hours_per_day, min_hours_for_present, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    f"TEST_{datetime.now().strftime('%Y%m%d%H%M%S')}",
    company_id,
    "Test Internship (5 min)",
    "Testing auto-attendance",
    manager_id,
    start_date.isoformat(),
    end_date.isoformat(),
    "10:00",
    "17:00",
    0,  # No lunch break for testing
    0.1,  # 6 minutes required
    0.05,  # 3 minutes minimum
    "active"
))

conn.commit()
conn.close()
print("Test internship created!")