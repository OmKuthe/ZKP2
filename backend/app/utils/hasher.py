import hashlib

def hash_student_id(student_id: str, salt: str = "zkattend_salt_2026") -> str:
    """Hash student ID with salt for privacy"""
    combined = f"{salt}:{student_id}"
    return hashlib.sha256(combined.encode()).hexdigest()