# backend/app/services/hash_chain.py
"""
Hash Chain Service - Phase 2B
Generates and verifies hash chains for session integrity.

Chain: seed → h1 → h2 → h3 → ... → hN
Where hN = SHA256(hN-1)

Server stores only the ROOT (hN).
App reveals links one by one: h1, h2, h3, ...
Server verifies: SHA256(h1) == root, SHA256(h2) == h1, etc.
"""
import hashlib
import os
from typing import List, Optional, Tuple


class HashChainService:
    """
    Service for generating and verifying hash chains.
    """
    
    def __init__(self, chain_length: int = 100):
        """
        Initialize with chain length.
        
        Args:
            chain_length: Number of links in the chain (default: 100)
                         100 links = ~25 hours of checks at 15-min intervals
        """
        self.chain_length = chain_length
    
    def generate_seed(self) -> str:
        """Generate a random seed (32 bytes hex)"""
        return os.urandom(32).hex()
    
    def generate_chain(self, seed: str) -> List[str]:
        """
        Generate a hash chain of length N.
        
        Returns: [h1, h2, h3, ..., hN]
        where h1 = SHA256(seed), h2 = SHA256(h1), etc.
        """
        chain = []
        current = seed
        
        for _ in range(self.chain_length):
            current = hashlib.sha256(current.encode()).hexdigest()
            chain.append(current)
        
        return chain
    
    def compute_root(self, seed: str) -> str:
        """Compute the root (final hash) of the chain"""
        chain = self.generate_chain(seed)
        return chain[-1]
    
    def verify_link(self, link: str, previous_link: str) -> bool:
        """
        Verify that 'link' hashes to 'previous_link'.
        
        Returns True if SHA256(link) == previous_link
        """
        computed = hashlib.sha256(link.encode()).hexdigest()
        return computed == previous_link
    
    def verify_chain_complete(self, chain: List[str], root: str) -> bool:
        """
        Verify the entire chain from seed to root.
        
        Args:
            chain: Full chain [h1, h2, ..., hN]
            root: Expected root (hN)
            
        Returns:
            True if the chain is valid
        """
        if not chain:
            return False
        
        # Check that the last link matches the root
        if chain[-1] != root:
            return False
        
        # Verify each link in the chain
        current = chain[0]
        for i in range(1, len(chain)):
            if hashlib.sha256(current.encode()).hexdigest() != chain[i]:
                return False
            current = chain[i]
        
        return True
    
    def get_remaining_links(self, current_index: int) -> int:
        """Get number of remaining links in the chain"""
        return self.chain_length - current_index - 1
    
    def get_link_at_index(self, chain: List[str], index: int) -> Optional[str]:
        """Get link at specific index"""
        if 0 <= index < len(chain):
            return chain[index]
        return None
    
    def generate_full_chain(self, seed: str) -> Tuple[List[str], str]:
        """
        Generate full chain and return (chain, root)
        """
        chain = self.generate_chain(seed)
        root = chain[-1]
        return chain, root
    
    def get_hash_at_index(self, seed: str, index: int) -> Optional[str]:
        """
        Get hash at specific index without generating full chain.
        This is useful for the app to compute links on demand.
        """
        if index < 0 or index >= self.chain_length:
            return None
        
        chain = self.generate_chain(seed)
        return chain[index]