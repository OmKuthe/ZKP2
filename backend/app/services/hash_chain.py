# backend/app/services/hash_chain.py
"""
Hash Chain Service - Counter-based approach
Each check uses: SHA256(seed + ":" + counter)
Counter increments with each successful check.
"""
import hashlib
import os
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class HashChainService:
    """
    Counter-based hash chain service.
    
    Each check uses: SHA256(seed + ":" + counter)
    Counter increments with each successful check.
    """
    
    def __init__(self):
        pass
    
    def generate_seed(self) -> str:
        """Generate a random seed (32 bytes hex)"""
        return os.urandom(32).hex()
    
    def get_hash(self, seed: str, counter: int) -> str:
        """
        Get hash for a specific counter value.
        hash = SHA256(seed + ":" + counter)
        """
        combined = f"{seed}:{counter}"
        return hashlib.sha256(combined.encode()).hexdigest()
    
    def verify_hash(self, seed: str, counter: int, provided_hash: str) -> bool:
        """
        Verify that provided_hash matches SHA256(seed + ":" + counter)
        """
        expected = self.get_hash(seed, counter)
        return expected == provided_hash
    
    def get_next_hash(self, seed: str, counter: int) -> str:
        """Get the next hash (for the next counter value)"""
        return self.get_hash(seed, counter + 1)
    
    def get_exit_hash(self, seed: str) -> str:
        """Get the exit hash: SHA256(seed + ":exit")"""
        combined = f"{seed}:exit"
        return hashlib.sha256(combined.encode()).hexdigest()
    
    def verify_exit_hash(self, seed: str, provided_hash: str) -> bool:
        """Verify the exit hash"""
        expected = self.get_exit_hash(seed)
        return expected == provided_hash