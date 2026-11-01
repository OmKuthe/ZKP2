# backend/app/zk/verifier.py
"""
ZKP Verification - Phase 3A
Verifies QR knowledge proofs using snarkjs
"""
import json
import os
import subprocess
import tempfile
from typing import Dict, Any, List, Tuple
import logging

logger = logging.getLogger(__name__)

class QRProofVerifier:
    """Verifies ZK proofs for QR knowledge"""
    
    def __init__(self):
        self.verification_key = self._load_verification_key()
    
    def _load_verification_key(self):
        """Load the verification key from file"""
        key_path = os.path.join(os.path.dirname(__file__), 'verification_key.json')
        try:
            with open(key_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Verification key not found at {key_path}")
            raise RuntimeError("Verification key not found. Run the circuit compilation first.")
    
    def verify_proof(
        self,
        proof: Dict[str, Any],
        public_signals: List[str]
    ) -> Tuple[bool, str]:
        """
        Verify a ZK proof using snarkjs CLI
        
        Args:
            proof: The proof object from snarkjs
            public_signals: The public inputs (commitment, student_id)
        
        Returns:
            (is_valid, message)
        """
        try:
            # Create temporary files
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as proof_file:
                json.dump(proof, proof_file)
                proof_path = proof_file.name
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as pub_file:
                json.dump(public_signals, pub_file)
                pub_path = pub_file.name
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as vk_file:
                json.dump(self.verification_key, vk_file)
                vk_path = vk_file.name
            
            # Use snarkjs CLI to verify
            try:
                result = subprocess.run(
                    [
                        'snarkjs', 'groth16', 'verify',
                        vk_path,
                        pub_path,
                        proof_path
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0 and 'OK' in result.stdout:
                    return True, "ZKP verified successfully"
                else:
                    return False, f"ZKP verification failed: {result.stderr or result.stdout}"
                    
            except subprocess.TimeoutExpired:
                return False, "ZKP verification timed out"
            finally:
                # Clean up temp files
                for path in [proof_path, pub_path, vk_path]:
                    try:
                        os.unlink(path)
                    except:
                        pass
                    
        except Exception as e:
            logger.error(f"Verification error: {e}")
            return False, f"Verification failed: {str(e)}"


# Singleton instance
_verifier = None

def get_verifier() -> QRProofVerifier:
    global _verifier
    if _verifier is None:
        _verifier = QRProofVerifier()
    return _verifier