// zkattend-mobile/app/utils/commitment.ts
/**
 * Helper utilities for Wi-Fi fingerprint data.
 *
 * The old version hashed BSSIDs into a commitment.
 * We no longer do that — the server receives the raw AP list (over TLS)
 * and computes JSR (Jaccard Similarity with RSSI).
 *
 * This file now provides shape-conversion helpers.
 */
import { ScannedAP } from '../native/wifi-scanner';

/**
 * Shape of an APR as expected by the backend.
 * Matches backend/schemas/wifi.py:AccessPointRepresentation
 */
export interface APRepresentation {
  bssid: string;
  rssi: number;
  frequency?: number;
  capabilities?: string;
}

/**
 * Convert a ScannedAP to the backend's APRepresentation shape.
 */
export function toAPRepresentation(ap: ScannedAP): APRepresentation {
  const out: APRepresentation = {
    bssid: ap.bssid.toUpperCase(),
    rssi: ap.rssi,
  };
  if (ap.frequency !== undefined) out.frequency = ap.frequency;
  if (ap.capabilities) out.capabilities = ap.capabilities;
  return out;
}

/**
 * Convert an entire array of ScannedAPs.
 */
export function toAPList(aps: ScannedAP[]): APRepresentation[] {
  return aps.map(toAPRepresentation);
}

/**
 * Convert multiple scan rounds.
 */
export function toAPListRounds(
  rounds: ScannedAP[][]
): APRepresentation[][] {
  return rounds.map((round) => toAPList(round));
}

// ============================================================
// Legacy helpers (kept so nothing else breaks)
// ============================================================

/**
 * @deprecated — The server compares raw APRs now.
 */
export async function generateCommitment(
  _bssids: string[],
  _salt: string
): Promise<string> {
  console.warn(
    '⚠️ generateCommitment is deprecated. Wi-Fi fingerprinting uses raw APRs now.'
  );
  return '';
}

/**
 * @deprecated — Use the server response instead.
 */
export function calculateOverlap(
  _reference: string[],
  _current: string[]
): number {
  return 0;
}

/**
 * @deprecated — Use the server response instead.
 */
export function isEnvironmentMatch(
  _reference: string[],
  _current: string[],
  _threshold: number = 0.3
): boolean {
  return true;
}

/**
 * Generate a random salt.
 * Kept because some code paths still import it.
 */
export async function generateSalt(): Promise<string> {
  const Crypto = require('expo-crypto');
  const bytes = (await Crypto.getRandomBytesAsync(16)) as Uint8Array;
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}