// zkattend-mobile/app/context/ChallengeContext.tsx
/**
 * Owns the re-verify challenge state and renders the modal globally.
 *
 * - DashboardScreen's verification loop pushes challenge updates via
 *   setPendingChallenge().
 * - FaceVerifyScreen calls setSuspended(true) while the camera is open so
 *   the modal doesn't cover the face check, and clearChallenge() on success.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

import ChallengeMo from '../components/ChallengeModal';
import type { PendingChallengeInfo } from '../services/verificationLoop';

interface ChallengeContextValue {
  setPendingChallenge: (challenge: PendingChallengeInfo | null) => void;
  clearChallenge: () => void;
  setSuspended: (suspended: boolean) => void;
}

const ChallengeContext = createContext<ChallengeContextValue | null>(null);

interface ChallengeProviderProps {
  children: ReactNode;
  onScanFace: (challengeId: number) => void;
}

export function ChallengeProvider({ children, onScanFace }: ChallengeProviderProps) {
  const [challenge, setChallenge] = useState<PendingChallengeInfo | null>(null);
  const [suspended, setSuspended] = useState(false);

  const setPendingChallenge = useCallback(
    (c: PendingChallengeInfo | null) => setChallenge(c),
    []
  );
  const clearChallenge = useCallback(() => setChallenge(null), []);

  const value = useMemo(
    () => ({ setPendingChallenge, clearChallenge, setSuspended }),
    [setPendingChallenge, clearChallenge]
  );

  return (
    <ChallengeContext.Provider value={value}>
      {children}
      <ChallengeModal
        challenge={challenge}
        visible={!suspended}
        onScanFace={onScanFace}
        onExpired={clearChallenge}
      />
    </ChallengeContext.Provider>
  );
}

export function useChallenge(): ChallengeContextValue {
  const ctx = useContext(ChallengeContext);
  if (!ctx) {
    throw new Error('useChallenge must be used inside <ChallengeProvider>');
  }
  return ctx;
}