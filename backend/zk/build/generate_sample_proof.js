const snarkjs = require("snarkjs");
const fs = require("fs");

async function run() {
    // Same inputs as before (student inside classroom)
    const input = {
        pub_class_x: 28613900,
        pub_class_y: 77209000,
        pub_radius_sq: 2500000000,
        priv_student_x: 28614000,
        priv_student_y: 77209100
    };
    
    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "zk/build/proximity_js/proximity.wasm",
        "zk/zkey/proximity_final.zkey"
    );
    
    // Save to file for API testing
    const testData = {
        session_nonce: "test_session_001",
        student_id: "student_rahul_2024001",
        zk_proof: proof,
        public_signals: publicSignals
    };
    
    fs.writeFileSync("test_attendance_payload.json", JSON.stringify(testData, null, 2));
    console.log("✅ Saved test payload to test_attendance_payload.json");
    console.log("Proof size:", JSON.stringify(proof).length, "bytes");
    console.log("\nRun this curl command to test the API:");
    console.log('curl -X POST http://localhost:8000/api/attendance/submit \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d @test_attendance_payload.json');
}

run().catch(console.error);