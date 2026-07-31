# backend/test_proximity_proof.py
"""
Test Proximity ZKP generation on backend
Run: python test_proximity_proof.py
"""
import json
import subprocess
import tempfile
import os
import math

# Paths
CIRCUIT_DIR = "circuits/qr_proof/build"
WASM_PATH = os.path.join(CIRCUIT_DIR, "qr_proof_js", "qr_proof.wasm")
ZKEY_PATH = os.path.join(CIRCUIT_DIR, "circuit_final.zkey")

# Scale factor to convert float to integer
SCALE = 1_000_000  # 1e6 for 6 decimal places


def float_to_int(value: float) -> int:
    """Convert float to integer by scaling"""
    return int(round(value * SCALE))


def test_proximity_proof():
    print("🔐 Testing Proximity ZKP on Backend")
    print("=" * 50)
    
    # Original GPS coordinates
    company_lat = 18.5204
    company_lng = 73.8567
    radius_km = 2.0
    
    # Student is at the same location (inside geofence)
    student_lat = 18.5204
    student_lng = 73.8567
    
    # ✅ Convert to integers
    pub_class_x = float_to_int(company_lat)
    pub_class_y = float_to_int(company_lng)
    pub_radius_sq = int(radius_km * radius_km * SCALE * SCALE)  # radius^2 in scaled units
    priv_student_x = float_to_int(student_lat)
    priv_student_y = float_to_int(student_lng)
    
    # 1. Prepare input
    input_data = {
        "pub_class_x": pub_class_x,
        "pub_class_y": pub_class_y,
        "pub_radius_sq": pub_radius_sq,
        "priv_student_x": priv_student_x,
        "priv_student_y": priv_student_y,
    }
    
    print("📍 Original values:")
    print(f"   Company: ({company_lat}, {company_lng})")
    print(f"   Student: ({student_lat}, {student_lng})")
    print(f"   Radius: {radius_km} km")
    print("\n🔢 Scaled values:")
    print(f"   pub_class_x: {pub_class_x}")
    print(f"   pub_class_y: {pub_class_y}")
    print(f"   pub_radius_sq: {pub_radius_sq}")
    print(f"   priv_student_x: {priv_student_x}")
    print(f"   priv_student_y: {priv_student_y}")
    
    # 2. Create input file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(input_data, f)
        input_path = f.name
    
    # 3. Generate witness
    witness_path = tempfile.mktemp(suffix='.wtns')
    print(f"\n📝 Generating witness...")
    
    result = subprocess.run(
        ['snarkjs', 'wtns', 'calculate', WASM_PATH, input_path, witness_path],
        capture_output=True,
        text=True,
        shell=True
    )
    
    if result.returncode != 0:
        print(f"❌ Witness failed: {result.stderr}")
        print(f"   stdout: {result.stdout}")
        return
    
    print("✅ Witness generated")
    
    # 4. Generate proof
    proof_path = tempfile.mktemp(suffix='.json')
    pub_path = tempfile.mktemp(suffix='.json')
    
    print(f"🔐 Generating proof...")
    result = subprocess.run(
        ['snarkjs', 'groth16', 'prove', ZKEY_PATH, witness_path, proof_path, pub_path],
        capture_output=True,
        text=True,
        shell=True
    )
    
    if result.returncode != 0:
        print(f"❌ Proof failed: {result.stderr}")
        return
    
    print("✅ Proof generated")
    
    # 5. Load proof
    with open(proof_path, 'r') as f:
        proof = json.load(f)
    
    with open(pub_path, 'r') as f:
        public_signals = json.load(f)
    
    print(f"\n📊 Public signals: {public_signals}")
    print(f"   These are the public inputs (company location + radius)")
    print(f"   The proof proves that student is within the geofence")
    print(f"   WITHOUT revealing the student's actual location!")
    
    print("\n" + "=" * 50)
    print("✅ Proximity ZKP works on backend!")
    print(f"   Public signals: {len(public_signals)}")
    print(f"   Proof size: {len(str(proof))} bytes")
    
    # Clean up
    for path in [input_path, witness_path, proof_path, pub_path]:
        try:
            os.unlink(path)
        except:
            pass


if __name__ == "__main__":
    test_proximity_proof()