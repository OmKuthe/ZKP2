// backend/app/zk/generate_proof.js
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function generateProof(token, studentId, commitment) {
    const wasmPath = path.join(__dirname, '../../circuits/qr_proof/build/qr_proof_js/qr_proof.wasm');
    const zkeyPath = path.join(__dirname, '../../circuits/qr_proof/build/circuit_final.zkey');
    
    // Convert strings to field elements
    function stringToField(str) {
        let result = 0n;
        for (let i = 0; i < str.length; i++) {
            result = (result * 256n + BigInt(str.charCodeAt(i))) % 
                21888242871839275222246405745257275088548364400416034343698204186575808495617n;
        }
        return result;
    }
    
    const input = {
        commitment: stringToField(commitment),
        student_id: stringToField(studentId),
        token: stringToField(token),
    };
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
    );
    
    console.log(JSON.stringify({ proof, publicSignals }));
}

const args = process.argv.slice(2);
if (args.length === 3) {
    generateProof(args[0], args[1], args[2]);
}