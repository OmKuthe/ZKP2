// zkattend-mobile/app/utils/hashChain.ts
import * as Crypto from 'expo-crypto';

/**
 * Generate hash for a specific counter value
 * hash = SHA256(seed + ":" + counter)
 */
export async function getCounterHash(seed: string, counter: number): Promise<string> {
  const combined = `${seed}:${counter}`;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
}

/**
 * Generate the first hash (counter = 1)
 */
export async function getFirstHash(seed: string): Promise<string> {
  return getCounterHash(seed, 1);
}

/**
 * Generate the exit hash (counter = "exit")
 */
export async function getExitHash(seed: string): Promise<string> {
  const combined = `${seed}:exit`;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
}

/**
 * Get the next hash for a given counter
 */
export function getNextHash(seed: string, counter: number): Promise<string> {
  return getCounterHash(seed, counter + 1);
}