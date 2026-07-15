# check_student_data.py
import sqlite3
from datetime import date

conn = sqlite3.connect('zkattend.db')
cursor = conn.cursor()

print("=" * 50)
print("STUDENT DASHBOARD DIAGNOSTIC")
print("=" * 50)

# 1. Check students
print("\n1. STUDENTS:")
cursor.execute("SELECT student_id, current_internship_id FROM student_profiles")
students = cursor.fetchall()
for s in students:
    print(f"   Student: {s[0]}, Current Internship DB ID: {s[1]}")

# 2. Check internships
print("\n2. INTERNSHIPS:")
cursor.execute("SELECT id, internship_id, role_name, status, is_test_mode, start_date, end_date FROM internships")
internships = cursor.fetchall()
for i in internships:
    print(f"   ID: {i[0]}, Code: {i[1]}, Role: {i[2]}, Status: {i[3]}, Test Mode: {i[4]}, Dates: {i[5]} to {i[6]}")

# 3. Check enrollments
print("\n3. ENROLLMENTS:")
cursor.execute("SELECT student_id, internship_id, status FROM internship_enrollments")
enrollments = cursor.fetchall()
for e in enrollments:
    print(f"   Student: {e[0]}, Internship DB ID: {e[1]}, Status: {e[2]}")

# 4. Check today's date vs internship dates
today = date.today()
print(f"\n4. TODAY'S DATE: {today}")

cursor.execute("SELECT id, internship_id, start_date, end_date, status FROM internships WHERE start_date <= ? AND end_date >= ?", (today, today))
active_by_date = cursor.fetchall()
print(f"   Internships active by date: {len(active_by_date)}")
for a in active_by_date:
    print(f"   - {a[1]}: {a[2]} to {a[3]} (status: {a[4]})")

# 5. Check company locations
print("\n5. COMPANIES:")
cursor.execute("SELECT id, name, latitude, longitude, radius_meters FROM companies")
companies = cursor.fetchall()
for c in companies:
    print(f"   {c[1]}: ({c[2]}, {c[3]}) radius: {c[4]}m")

conn.close()

print("\n" + "=" * 50)
print("Tell me what you see above and I'll fix the issue!")