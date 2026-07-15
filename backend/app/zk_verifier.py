
import subprocess
import json
import tempfile
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent
VK_PATH = BACKEND_DIR / "zk" / "zkey" / "verification_key.json"

# Create a Node.js verification script on first use
VERIFY_JS = BACKEND_DIR / "verify_helper.js"

if not VERIFY_JS.exists():
    with open(VERIFY_JS, "w") as f:
        f.write('''
const snarkjs = require("snarkjs");
const fs = require("fs");

async function verify() {
    const vkey = JSON.parse(fs.readFileSync(process.argv[2]));
    const proof = JSON.parse(fs.readFileSync(process.argv[3]));
    const publicSignals = JSON.parse(fs.readFileSync(process.argv[4]));
    
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    if (isValid) {
        console.log("OK!");
        process.exit(0);
    } else {
        console.log("INVALID");
        process.exit(1);
    }
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
''')

async def verify_zk_proof(proof_dict: dict, public_signals: list) -> bool:
    """
    Verify a ZK proof using snarkjs via Node.js
    """
    
    if not VK_PATH.exists():
        raise FileNotFoundError(f"Verification key not found at {VK_PATH}")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # Write proof to file
            proof_path = os.path.join(tmpdir, "proof.json")
            with open(proof_path, "w") as f:
                json.dump(proof_dict, f)
            
            # Write public signals to file
            public_path = os.path.join(tmpdir, "public.json")
            signals_str = [str(s) for s in public_signals]
            with open(public_path, "w") as f:
                json.dump(signals_str, f)
            
            # Run Node.js verification script
            cmd = [
                "node",
                str(VERIFY_JS),
                str(VK_PATH),
                proof_path,
                public_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            return "OK!" in result.stdout
            
        except subprocess.TimeoutExpired:
            print("ZK verification timed out")
            return False
        except Exception as e:
            print(f"ZK verification error: {e}")
            return False