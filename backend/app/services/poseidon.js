// backend/app/services/poseidon.js
const { poseidon } = require('circomlibjs');

function computePoseidon(token, studentId) {
    // Convert strings to BigInts
    const tokenBigInt = BigInt('0x' + Buffer.from(token).toString('hex'));
    const studentBigInt = BigInt('0x' + Buffer.from(studentId).toString('hex'));
    
    // Compute Poseidon hash
    const hash = poseidon([tokenBigInt, studentBigInt]);
    
    // Convert to string
    return hash.toString();
}

// Read input from command line
const args = process.argv.slice(2);
if (args.length === 2) {
    const token = args[0];
    const studentId = args[1];
    const result = computePoseidon(token, studentId);
    console.log(result);
}