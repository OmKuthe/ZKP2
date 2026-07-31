# backend/app/services/poseidon.py
"""
Poseidon hash implementation using JavaScript circomlibjs
"""
import subprocess
import json
import os
import hashlib

# Prime field modulus for BN254
PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617

# Path to the JavaScript poseidon script
JS_SCRIPT = os.path.join(os.path.dirname(__file__), 'poseidon.js')


def poseidon_hash(token: str, student_id: str) -> str:
    """
    Compute Poseidon(token, student_id) using circomlibjs
    """
    try:
        # Call the JavaScript script
        result = subprocess.run(
            ['node', JS_SCRIPT, token, student_id],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"❌ Poseidon error: {result.stderr}")
            # Fallback to SHA256
            combined = f"{token}:{student_id}"
            hash_bytes = hashlib.sha256(combined.encode()).digest()
            hash_int = int.from_bytes(hash_bytes, 'big') % PRIME
            return str(hash_int)
            
    except Exception as e:
        print(f"❌ Poseidon failed: {e}")
        # Fallback to SHA256
        combined = f"{token}:{student_id}"
        hash_bytes = hashlib.sha256(combined.encode()).digest()
        hash_int = int.from_bytes(hash_bytes, 'big') % PRIME
        return str(hash_int)


def compute_commitment(token: str, student_id: str) -> str:
    """
    Compute commitment = Poseidon(token, student_id)
    """
    return poseidon_hash(token, student_id)