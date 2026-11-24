// zkattend-mobile/app/utils/challengeBus.ts
/**
 * Tiny event bus for pending challenges.
 *
 * Why: verificationLoop fires the event but lives in a service (no React tree).
 * ChallengeModal needs to react to it but lives in the tree.
 * Bus bridges them.
 */
import type { PendingChallengeInfo } from '../services/verificationLoop';

type Listener = (challenge: PendingChallengeInfo) => void;

const listeners: Set<Listener> = new Set();

export const challengeBus = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emit(challenge: PendingChallengeInfo): void {
    for (const listener of listeners) {
      try {
        listener(challenge);
      } catch (err) {
        console.warn('⚠️ challengeBus listener error:', err);
      }
    }
  },
};