// Simple offline storage for proofs
const STORAGE_KEY = 'pending_proofs';

export const saveProofOffline = async (proofData) => {
  const pending = await getPendingProofs();
  pending.push({
    ...proofData,
    id: Date.now(),
    synced: false,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
};

export const getPendingProofs = async () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const clearSyncedProofs = async () => {
  const pending = await getPendingProofs();
  const unsynced = pending.filter(p => !p.synced);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unsynced));
};