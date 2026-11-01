# backend/app/zk/proof_generator.py
"""
Generate ZK proofs on backend using snarkjs
"""
import json
import os
import subprocess
import tempfile
from typing import Dict, Any, List, Tuple
import logging

logger = logging.getLogger(__name__)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CIRCUIT_DIR = os.path.join(BASE_DIR, 'circuits', 'qr_proof', 'build')
WASM_PATH = os.path.join(CIRCUIT_DIR, 'qr_proof_js', 'qr_proof.wasm')
ZKEY_PATH = os.path.join(CIRCUIT_DIR, 'circuit_final.zkey')

# Scale factor for coordinates (6 decimal places)
SCALE = 1_000_000

logger.info(f"📁 Circuit directory: {CIRCUIT_DIR}")
logger.info(f"📁 WASM path: {WASM_PATH}")
logger.info(f"📁 ZKEY path: {ZKEY_PATH}")


def float_to_field(value: float) -> int:
    """Convert float to integer field element"""
    return int(round(value * SCALE))


def generate_proximity_proof(
    student_lat: float,
    student_lng: float,
    company_lat: float,
    company_lng: float,
    radius_km: float
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Generate Proximity ZKP on backend
    
    Proves: Student is within the geofence
    Public: company_lat, company_lng, radius_sq
    Private: student_lat, student_lng
    """
    try:
        logger.info(f"🔐 Generating Proximity proof")
        logger.info(f"   Student: ({student_lat}, {student_lng})")
        logger.info(f"   Company: ({company_lat}, {company_lng})")
        logger.info(f"   Radius: {radius_km} km")
        
        # Scale inputs
        pub_class_x = float_to_field(company_lat)
        pub_class_y = float_to_field(company_lng)
        pub_radius_sq = int(radius_km * radius_km * SCALE * SCALE)
        priv_student_x = float_to_field(student_lat)
        priv_student_y = float_to_field(student_lng)
        
        # Prepare circuit inputs
        input_data = {
            "pub_class_x": pub_class_x,
            "pub_class_y": pub_class_y,
            "pub_radius_sq": pub_radius_sq,
            "priv_student_x": priv_student_x,
            "priv_student_y": priv_student_y,
        }
        
        logger.info(f"📝 Scaled inputs:")
        logger.info(f"   pub_class_x: {pub_class_x}")
        logger.info(f"   pub_class_y: {pub_class_y}")
        logger.info(f"   pub_radius_sq: {pub_radius_sq}")
        logger.info(f"   priv_student_x: {priv_student_x}")
        logger.info(f"   priv_student_y: {priv_student_y}")
        
        # Create temporary input file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(input_data, f)
            input_path = f.name
        
        # Create temporary output files
        witness_path = tempfile.mktemp(suffix='.wtns')
        proof_path = tempfile.mktemp(suffix='.json')
        pub_path = tempfile.mktemp(suffix='.json')
        
        try:
            # Step 1: Generate witness
            logger.info("📝 Generating witness...")
            witness_result = subprocess.run(
                ['npx','snarkjs', 'wtns', 'calculate', WASM_PATH, input_path, witness_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if witness_result.returncode != 0:
                logger.error(f"❌ Witness stderr: {witness_result.stdout}")
                logger.error(f"❌ Witness stderr: {witness_result.stderr}")
                raise RuntimeError(f"Witness generation failed: {witness_result.stderr}")
            
            logger.info("✅ Witness generated")
            
            # Step 2: Generate proof
            logger.info("🔐 Generating proof...")
            proof_result = subprocess.run(
                ['npx','snarkjs', 'groth16', 'prove', ZKEY_PATH, witness_path, proof_path, pub_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if proof_result.returncode != 0:
                logger.error(f"❌ Proof stderr: {proof_result.stderr}")
                raise RuntimeError(f"Proof generation failed: {proof_result.stderr}")
            
            logger.info("✅ Proof generated")
            
            # Load proof and public signals
            with open(proof_path, 'r') as f:
                proof = json.load(f)
            
            with open(pub_path, 'r') as f:
                public_signals = json.load(f)
            
            logger.info(f"   Public signals: {public_signals}")
            logger.info(f"   Proof size: {len(str(proof))} bytes")
            
            return proof, public_signals
            
        finally:
            # Clean up temp files
            for path in [input_path, witness_path, proof_path, pub_path]:
                try:
                    if os.path.exists(path):
                        os.unlink(path)
                except:
                    pass
                
    except Exception as e:
        logger.error(f"❌ Proof generation failed: {e}")
        raise


def generate_and_verify_proximity_proof(
    student_lat: float,
    student_lng: float,
    company_lat: float,
    company_lng: float,
    radius_km: float
) -> Tuple[bool, str, Dict[str, Any], List[str]]:
    """
    Generate and verify Proximity proof in one function
    """
    try:
        proof, public_signals = generate_proximity_proof(
            student_lat, student_lng,
            company_lat, company_lng,
            radius_km
        )
        
        from .verifier import get_verifier
        verifier = get_verifier()
        is_valid, message = verifier.verify_proof(proof, public_signals)
        
        logger.info(f"📊 Verification result: {is_valid} - {message}")
        
        return is_valid, message, proof, public_signals
        
    except Exception as e:
        logger.error(f"❌ Generate and verify failed: {e}")
        return False, str(e), None, None