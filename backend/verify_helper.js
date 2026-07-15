
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
