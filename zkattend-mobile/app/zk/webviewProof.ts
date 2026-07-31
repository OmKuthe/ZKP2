// zkattend-mobile/app/zk/webviewProof.ts
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

export interface ProofResult {
  proof: any;
  publicSignals: string[];
}

export async function prepareProofData(
  token: string,
  studentId: string,
  commitment: string
): Promise<{ wasm: string; zkey: string; input: any }> {
  try {
    // Load assets using expo-asset
    const wasmAsset = Asset.fromModule(require('../../assets/circuits/qr_proof.wasm'));
    const zkeyAsset = Asset.fromModule(require('../../assets/circuits/qr_proof.zkey'));

    // Ensure assets are downloaded
    await wasmAsset.downloadAsync();
    await zkeyAsset.downloadAsync();

    console.log(`📁 WASM localUri: ${wasmAsset.localUri}`);
    console.log(`📁 ZKEY localUri: ${zkeyAsset.localUri}`);

    // Read files as base64 using legacy API
    const wasmBase64 = await FileSystem.readAsStringAsync(wasmAsset.localUri!, {
      encoding: 'base64',
    });
    const zkeyBase64 = await FileSystem.readAsStringAsync(zkeyAsset.localUri!, {
      encoding: 'base64',
    });

    console.log(`📦 WASM base64 length: ${wasmBase64.length}`);
    console.log(`📦 ZKEY base64 length: ${zkeyBase64.length}`);

    // Prepare input for the circuit
    const input = {
      commitment: stringToField(commitment),
      student_id: stringToField(studentId),
      token: stringToField(token),
    };

    return {
      wasm: wasmBase64,
      zkey: zkeyBase64,
      input,
    };
  } catch (error) {
    console.error('❌ Failed to prepare proof data:', error);
    throw error;
  }
}

// Helper: Convert string to field element
function stringToField(str: string): bigint {
  const prime = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  let result = 0n;
  for (let i = 0; i < str.length; i++) {
    result = (result * 256n + BigInt(str.charCodeAt(i))) % prime;
  }
  return result;
}
