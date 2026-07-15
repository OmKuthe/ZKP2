import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('zkattend.db')
cursor = conn.cursor()

print("=" * 50)
print("FIXING STUDENT INTERNSHIP ISSUE")
print("=" * 50)

# 1. Check current state
print("\n1. CURRENT STATE:")
cursor.execute("SELECT id, internship_id, role_name, start_date, end_date FROM internships")
internships = cursor.fetchall()
print(f"   Existing internships: {internships}")

cursor.execute("SELECT student_id, current_internship_id FROM student_profiles WHERE student_id = 'stud01'")
student = cursor.fetchone()
print(f"   Student stud01 current_internship_id: {student[1]}")

# 2. Fix: Update student's current_internship_id to a valid internship ID
# Use the first valid internship ID (which is 1)
cursor.execute("""
    UPDATE student_profiles 
    SET current_internship_id = 1 
    WHERE student_id = 'stud01'
""")
conn.commit()
print("\n2. FIXED: Updated student's current_internship_id to 1")

# 3. Clean up duplicate enrollments (keep only one)
cursor.execute("""
    DELETE FROM internship_enrollments 
    WHERE id NOT IN (
        SELECT MIN(id) 
        FROM internship_enrollments 
        WHERE student_id = 'stud01'
        GROUP BY student_id, internship_id
    )
""")
conn.commit()
print("3. FIXED: Removed duplicate enrollments")

# 4. Create a proper test internship with today's date
today = datetime.now().date()
end_date = today + timedelta(days=30)

cursor.execute("""
    INSERT OR REPLACE INTO internships (
        id, internship_id, company_id, role_name, description, manager_id,
        start_date, end_date, daily_start_time, daily_end_time,
        lunch_break_minutes, required_hours_per_day, min_hours_for_present, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    1, "INT001", 1, "Software Development Intern", "Test Internship for stud01",
    "MGR001", today, end_date, "10:00", "17:00",
    60, 6.0, 5.0, "active"
))
conn.commit()
print("4. FIXED: Updated internship with proper dates")

# 5. Verify the fix
print("\n5. VERIFICATION:")
cursor.execute("""
    SELECT s.student_id, s.current_internship_id, i.internship_id, i.role_name, i.start_date, i.end_date
    FROM student_profiles s
    LEFT JOIN internships i ON s.current_internship_id = i.id
    WHERE s.student_id = 'stud01'
""")
result = cursor.fetchone()
print(f"   Student: {result[0]}")
print(f"   Current Internship DB ID: {result[1]}")
print(f"   Internship Code: {result[2]}")
print(f"   Role: {result[3]}")
print(f"   Period: {result[4]} to {result[5]}")

# 6. Check if today is within internship period
today = datetime.now().date()
start = datetime.strptime(result[4], '%Y-%m-%d').date() if result[4] else None
end = datetime.strptime(result[5], '%Y-%m-%d').date() if result[5] else None

if start and end:
    is_active = start <= today <= end
    print(f"\n   Today ({today}) is within internship period: {is_active}")
    if is_active:
        print("   ✅ Internship is ACTIVE - Student should see it!")
    else:
        print("   ❌ Internship is NOT active - Check dates")

conn.close()

print("\n" + "=" * 50)
print("✅ FIX COMPLETE! Restart your backend and login as student.")
print("=" * 50)