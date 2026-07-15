const snarkjs = require("snarkjs");
const fs = require("fs");

async function run() {
    console.log("\n=== ZKAttend Demo: Proving I'm Inside Classroom ===\n");
    
    // Classroom: IIT Delhi coordinates (multiplied by 1e6)
    const classX = 28613900;      // 28.6139°
    const classY = 77209000;      // 77.2090°
    const radiusMeters = 50;
    const radiusSq = radiusMeters * radiusMeters * 1000000; // Scale for precision
    
    // Student: Inside classroom (1 meter from center)
    const studentX = 28614000;    // 28.6140° (inside)
    const studentY = 77209100;    // 77.2091° (inside)
    
    console.log("1. Input Data:");
    console.log("   Classroom center (public):", classX, classY);
    console.log("   Radius squared (public):", radiusSq);
    console.log("   Student location (private):", studentX, studentY);
    console.log("   ▶ Is student inside?", Math.sqrt((studentX-classX)**2 + (studentY-classY)**2) / 1000, "meters\n");
    
    // Create input for circuit
    const input = {
        pub_class_x: classX,
        pub_class_y: classY,
        pub_radius_sq: radiusSq,
        priv_student_x: studentX,
        priv_student_y: studentY
    };
    
    // Generate proof
    console.log("2. Generating ZK Proof on device...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "zk/build/proximity_js/proximity.wasm",
        "zk/zkey/proximity_final.zkey"
    );
    console.log("   ✓ Proof generated!\n");
    
    // Verify proof
    console.log("3. Verifying proof on server...");
    const vkey = JSON.parse(fs.readFileSync("zk/zkey/verification_key.json"));
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    if (isValid) {
        console.log("   ✓ PROOF VALID! Student is inside classroom!\n");
    } else {
        console.log("   ✗ PROOF INVALID!\n");
    }
    
    // Show what gets sent to server
    console.log("4. What server receives (no location data):");
    console.log("   Public signals:", publicSignals);
    console.log("   Proof size:", JSON.stringify(proof).length, "bytes");
    console.log("\n   ✓ Server knows student attended WITHOUT knowing exact location!");
}

run().catch(console.error);