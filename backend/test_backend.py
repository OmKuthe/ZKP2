import requests
import json
from datetime import datetime
import time

BASE_URL = "http://localhost:8000"

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(test_name, passed, response=None):
    status = f"{Colors.GREEN}✓ PASSED{Colors.RESET}" if passed else f"{Colors.RED}✗ FAILED{Colors.RESET}"
    print(f"{status} - {test_name}")
    if response and not passed:
        print(f"    Response: {response}")

def test_backend():
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}Testing ZKAttend Backend API{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")

    # Test 1: Root endpoint
    try:
        response = requests.get(f"{BASE_URL}/")
        print_test("Root endpoint", response.status_code == 200, response.text)
    except Exception as e:
        print_test("Root endpoint", False, str(e))

    # Test 2: Health endpoint
    try:
        response = requests.get(f"{BASE_URL}/health")
        print_test("Health check", response.status_code == 200, response.text)
    except Exception as e:
        print_test("Health check", False, str(e))

    # Test 3: Admin Login
    print(f"\n{Colors.BLUE}--- Authentication Tests ---{Colors.RESET}")
    admin_token = None
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/admin/login",
            json={"faculty_id": "admin", "password": "admin123"}
        )
        if response.status_code == 200:
            admin_token = response.json()["token"]
            print_test("Admin login", True, response.json())
        else:
            print_test("Admin login", False, response.text)
    except Exception as e:
        print_test("Admin login", False, str(e))

    # Test 4: Create Student
    print(f"\n{Colors.BLUE}--- User Management Tests ---{Colors.RESET}")
    student_id = None
    if admin_token:
        try:
            student_data = {
                "student_id": "STU001",
                "email": "student@test.com",
                "full_name": "Test Student",
                "roll_number": "2024001",
                "department": "Computer Science",
                "year": 2,
                "semester": 3,
                "phone_number": "1234567890"
            }
            response = requests.post(
                f"{BASE_URL}/api/admin/students/create?admin_token=admin_secret_key_2026",
                json=student_data
            )
            if response.status_code == 200:
                student_id = "STU001"
                print_test("Create student", True, response.json())
            else:
                print_test("Create student", False, response.text)
        except Exception as e:
            print_test("Create student", False, str(e))
    else:
        print_test("Create student (skipped - no admin token)", False)

    # Test 5: Create Faculty
    faculty_id = None
    if admin_token:
        try:
            faculty_data = {
                "faculty_id": "FAC001",
                "email": "faculty@test.com",
                "full_name": "Prof. John Smith",
                "department": "Computer Science",
                "designation": "Professor",
                "phone_number": "9876543210",
                "password": "faculty123"
            }
            response = requests.post(
                f"{BASE_URL}/api/admin/faculty/create?admin_token=admin_secret_key_2026",
                json=faculty_data
            )
            if response.status_code == 200:
                faculty_id = "FAC001"
                print_test("Create faculty", True, response.json())
            else:
                print_test("Create faculty", False, response.text)
        except Exception as e:
            print_test("Create faculty", False, str(e))
    else:
        print_test("Create faculty (skipped - no admin token)", False)

    # Test 6: List Students
    if admin_token:
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/students/list?admin_token=admin_secret_key_2026"
            )
            print_test("List students", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("List students", False, str(e))
    else:
        print_test("List students (skipped - no admin token)", False)

    # Test 7: List Faculty
    if admin_token:
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/faculty/list?admin_token=admin_secret_key_2026"
            )
            print_test("List faculty", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("List faculty", False, str(e))
    else:
        print_test("List faculty (skipped - no admin token)", False)

    # Test 8: Student Login
    print(f"\n{Colors.BLUE}--- Student Flow Tests ---{Colors.RESET}")
    student_token = None
    if student_id:
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/student/login",
                json={"student_id": student_id}
            )
            if response.status_code == 200:
                student_token = response.json()["token"]
                print_test("Student login", True, response.json())
            else:
                print_test("Student login", False, response.text)
        except Exception as e:
            print_test("Student login", False, str(e))
    else:
        print_test("Student login (skipped - no student)", False)

    # Test 9: Faculty Login
    print(f"\n{Colors.BLUE}--- Faculty Flow Tests ---{Colors.RESET}")
    faculty_token = None
    if faculty_id:
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/faculty/login",
                json={"faculty_id": faculty_id, "password": "faculty123"}
            )
            if response.status_code == 200:
                faculty_token = response.json()["token"]
                print_test("Faculty login", True, response.json())
            else:
                print_test("Faculty login", False, response.text)
        except Exception as e:
            print_test("Faculty login", False, str(e))
    else:
        print_test("Faculty login (skipped - no faculty)", False)

    # Test 10: Create Session (Faculty)
    session_nonce = None
    if faculty_token:
        try:
            response = requests.post(
                f"{BASE_URL}/api/session/start",
                params={
                    "faculty_id": faculty_id,
                    "lat": 37.7749,
                    "lng": -122.4194,
                    "radius": 100,
                    "duration_minutes": 60,
                    "department": "Computer Science"
                },
                headers={"Authorization": f"Bearer {faculty_token}"}
            )
            if response.status_code == 200:
                session_nonce = response.json()["session_nonce"]
                print_test("Create session", True, response.json())
            else:
                print_test("Create session", False, response.text)
        except Exception as e:
            print_test("Create session", False, str(e))
    else:
        print_test("Create session (skipped - no faculty token)", False)

    # Test 11: Get Session Details
    if session_nonce:
        try:
            response = requests.get(f"{BASE_URL}/api/session/{session_nonce}")
            print_test("Get session details", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("Get session details", False, str(e))
    else:
        print_test("Get session details (skipped - no session)", False)

    # Test 12: Get Active Sessions
    try:
        response = requests.get(f"{BASE_URL}/api/session/active/current")
        print_test("Get active sessions", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
    except Exception as e:
        print_test("Get active sessions", False, str(e))

    # Test 13: Get Faculty Sessions
    if faculty_token and faculty_id:
        try:
            response = requests.get(
                f"{BASE_URL}/api/session/faculty/{faculty_id}/sessions",
                headers={"Authorization": f"Bearer {faculty_token}"}
            )
            print_test("Get faculty sessions", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("Get faculty sessions", False, str(e))
    else:
        print_test("Get faculty sessions (skipped)", False)

    # Test 14: Admin Dashboard Stats
    if admin_token:
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/dashboard/stats?admin_token=admin_secret_key_2026"
            )
            print_test("Admin dashboard stats", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("Admin dashboard stats", False, str(e))
    else:
        print_test("Admin dashboard stats (skipped - no admin token)", False)

    # Test 15: Get All Sessions (Admin)
    if admin_token:
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin/sessions/all?admin_token=admin_secret_key_2026"
            )
            print_test("Get all sessions (admin)", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("Get all sessions (admin)", False, str(e))
    else:
        print_test("Get all sessions (admin) (skipped)", False)

    # Test 16: Student Attendance History
    if student_token and student_id:
        try:
            response = requests.get(
                f"{BASE_URL}/api/attendance/student/{student_id}/history",
                headers={"Authorization": f"Bearer {student_token}"}
            )
            print_test("Get student attendance history", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("Get student attendance history", False, str(e))
    else:
        print_test("Get student attendance history (skipped)", False)

    # Test 17: Verify Token
    if faculty_token:
        try:
            response = requests.get(
                f"{BASE_URL}/api/auth/verify",
                params={"token": faculty_token}
            )
            print_test("Verify token", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("Verify token", False, str(e))
    else:
        print_test("Verify token (skipped)", False)

    # Test 18: Logout
    if faculty_token:
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/logout",
                params={"token": faculty_token}
            )
            print_test("Logout", response.status_code == 200, response.json() if response.status_code == 200 else response.text)
        except Exception as e:
            print_test("Logout", False, str(e))
    else:
        print_test("Logout (skipped)", False)

    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}Testing Complete!{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")

if __name__ == "__main__":
    test_backend()