import * as snarkjs from 'snarkjs';

class ZKProofService {
  constructor() {
    this.wasmPath = '/circuits/proximity.wasm';
    this.zkeyPath = '/circuits/proximity_final.zkey';
  }

  /**
   * Convert lat/lng to integers for circuit input
   * @param {number} lat - Latitude (e.g., 28.6139)
   * @returns {number} - Integer representation (e.g., 28613900)
   */
  toIntegerCoordinate(coord) {
    return Math.round(coord * 1e6);
  }

  /**
   * Generate ZK proof for attendance
   * @param {Object} studentLocation - {lat, lng}
   * @param {Object} sessionData - {class_center_lat, class_center_lng, radius_meters}
   * @returns {Promise<{proof: Object, publicSignals: Array}>}
   */
  async generateProof(studentLocation, sessionData) {
    try {
      // Prepare circuit input
      const input = {
        // Public inputs
        pub_class_x: this.toIntegerCoordinate(sessionData.class_center_lat),
        pub_class_y: this.toIntegerCoordinate(sessionData.class_center_lng),
        pub_radius_sq: Math.pow(sessionData.radius_meters, 2) * 1e6,
        
        // Private inputs (never revealed)
        priv_student_x: this.toIntegerCoordinate(studentLocation.lat),
        priv_student_y: this.toIntegerCoordinate(studentLocation.lng)
      };

      console.log('Generating ZK proof with input:', input);
      console.log('Student location (private):', studentLocation);
      console.log('Class center (public):', {
        lat: sessionData.class_center_lat,
        lng: sessionData.class_center_lng,
        radius: sessionData.radius_meters
      });

      // Generate proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.wasmPath,
        this.zkeyPath
      );

      console.log('Proof generated successfully');
      console.log('Proof size:', JSON.stringify(proof).length, 'bytes');
      console.log('Public signals:', publicSignals);

      return { proof, publicSignals };
    } catch (error) {
      console.error('Error generating ZK proof:', error);
      throw new Error(`Failed to generate proof: ${error.message}`);
    }
  }

  /**
   * Verify proof locally (optional - for debugging)
   * @param {Object} proof - Generated proof
   * @param {Array} publicSignals - Public signals
   * @returns {Promise<boolean>}
   */
  async verifyProofLocally(proof, publicSignals) {
    try {
      const verificationKey = await fetch('/circuits/verification_key.json');
      const vKey = await verificationKey.json();
      
      const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      return isValid;
    } catch (error) {
      console.error('Local verification failed:', error);
      return false;
    }
  }
}

export default new ZKProofService();