// zkattend-mobile/app/utils/commitment.ts
import * as Crypto from 'expo-crypto';

/**
 * Generate a commitment from environment data
 */
export async function generateCommitment(
  bssids: string[],
  salt: string
): Promise<string> {
  const sorted = [...bssids].sort();
  const combined = sorted.join(',') + ':' + salt;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
}

/**
 * Calculate overlap between two environments
 * Returns percentage (0-1)
 */
export function calculateOverlap(
  reference: string[],
  current: string[]
): number {
  if (reference.length === 0) return 0;
  
  const set = new Set(reference);
  let matches = 0;
  for (const item of current) {
    if (set.has(item)) matches++;
  }
  return matches / reference.length;
}

/**
 * Check if environments match with LOW threshold (0.3 = 30% overlap)
 * This means even if location changes slightly, it still passes
 */
export function isEnvironmentMatch(
  reference: string[],
  current: string[],
  threshold: number = 0.3
): boolean {
  const overlap = calculateOverlap(reference, current);
  console.log(`📊 Overlap: ${(overlap * 100).toFixed(0)}% (threshold: ${(threshold * 100).toFixed(0)}%)`);
  return overlap >= threshold;
}

/**
 * Generate random salt
 */
export async function generateSalt(): Promise<string> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(saltBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}