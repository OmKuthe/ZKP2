"""
Test Admin APIs
Run: python test_admin.py
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

print("=" * 60)
print("TESTING ADMIN APIS")
print("=" * 60)

# 1. Get dashboard stats
print("\n[1] Getting dashboard stats...")
resp = requests.get(f"{BASE_URL}/admin/dashboard/stats")
if resp.status_code == 200:
    data = resp.json()
    print("✅ Dashboard stats:")
    print(f"   Companies: {data['total_companies']}")
    print(f"   Students: {data['total_students']}")
    print(f"   Active Sessions: {data['active_sessions']}")
    print(f"   Attendance Rate: {data['attendance_rate']}%")
else:
    print(f"❌ Failed: {resp.text}")

# 2. Get companies
print("\n[2] Getting companies...")
resp = requests.get(f"{BASE_URL}/admin/companies")
if resp.status_code == 200:
    data = resp.json()
    print(f"✅ Companies: {data['total']}")
    for company in data['companies']:
        print(f"   - {company['name']}: {company['student_count']} students")
else:
    print(f"❌ Failed: {resp.text}")

# 3. Get students
print("\n[3] Getting students...")
resp = requests.get(f"{BASE_URL}/admin/students")
if resp.status_code == 200:
    data = resp.json()
    print(f"✅ Students: {data['total']}")
    for student in data['students']:
        print(f"   - {student['name']} ({student['student_id']})")
else:
    print(f"❌ Failed: {resp.text}")

print("\n" + "=" * 60)
print("✅ ADMIN API TESTS COMPLETE")
print("=" * 60)