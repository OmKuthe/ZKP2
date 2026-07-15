const snarkjs = require("snarkjs");
const fs = require("fs");

async function benchmark() {
    // Sample test inputs
    const input = {
        pub_class_x: 28613900,
        pub_class_y: 77209000,
        pub_radius_sq: 2500000000,
        priv_student_x: 28614000,
        priv_student_y: 77209100
    };

    console.log("==============================");
    console.log(" ZKP PERFORMANCE BENCHMARK ");
    console.log("==============================\n");

    // -------------------------------
    // PROOF GENERATION
    // -------------------------------
    console.time("Proof Generation Time");

    const { proof, publicSignals } =
        await snarkjs.groth16.fullProve(
            input,
            "zk/build/proximity_js/proximity.wasm",
            "zk/zkey/proximity_final.zkey"
        );

    console.timeEnd("Proof Generation Time");

    // -------------------------------
    // PROOF SIZE
    // -------------------------------
    const proofSize = JSON.stringify(proof).length;

    console.log("\nProof Size:", proofSize, "bytes");

    // -------------------------------
    // SAVE OUTPUTS
    // -------------------------------
    fs.writeFileSync(
        "generated_proof.json",
        JSON.stringify({ proof, publicSignals }, null, 2)
    );

    console.log("\nProof saved to generated_proof.json");

    // -------------------------------
    // LOAD VERIFICATION KEY
    // -------------------------------
    const vKey = JSON.parse(
        fs.readFileSync("zk/zkey/verification_key.json")
    );

    // -------------------------------
    // VERIFICATION
    // -------------------------------
    console.time("Verification Time");

    const verified = await snarkjs.groth16.verify(
        vKey,
        publicSignals,
        proof
    );

    console.timeEnd("Verification Time");

    console.log("\nVerification Result:", verified ? "VALID" : "INVALID");

    console.log("\n==============================");
    console.log(" BENCHMARK COMPLETED ");
    console.log("==============================");
}

benchmark().catch(console.error)