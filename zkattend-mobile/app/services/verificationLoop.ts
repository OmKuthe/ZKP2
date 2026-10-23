// zkattend-mobile/app/services/verificationLoop.ts
/**
 * Headless verification loop.
 *
 * One call = one full cycle (continuity + Wi-Fi).
 * The loop does NOT schedule itself — the caller owns the timer.
 *
 * Wi-Fi is gated by a mutable flag (_wifiEnabled), NOT by the startLoop
 * config. This is deliberate: enrollment happens asynchronously after
 * startLoop is called, and a frozen boolean would lock Wi-Fi off forever.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { studentAPI } from '../api/client';
import { captureEnvironment } from '../native/environment';
import { toAPList } from '../utils/commitment';
import { getCounterHash } from '../utils/hashChain';

// ============================================================
// Public types
// ============================================================

export type CycleReason = 'auto' | 'manual' | 'resume' | 'exit';

export interface ContinuityResult {
  attempted: boolean;
  verified: boolean;
  counter: number;
  message: string;
  error?: string;
}

export interface WifiResult {
  attempted: boolean;
  verified: boolean;
  score: number;
  anomaly: boolean;
  message: string;
  anomalyId?: number | null;
  error?: string;
}

export interface CycleResult {
  reason: CycleReason;
  timestamp: number;
  continuity: ContinuityResult;
  wifi: WifiResult;
}

export interface LoopConfig {
  sessionId: string;
  seed: string;
  studentId: string;
}

export interface LoopListeners {
  onContinuityResult?: (result: ContinuityResult) => void;
  onWifiResult?: (result: WifiResult) => void;
  onCycleComplete?: (result: CycleResult) => void;
}

// ============================================================
// Internal state (module-level singleton)
// ============================================================

interface StoredChainData {
  sessionId: string;
  seed: string;
  counter: number;
  studentId: string;
}

let _config: LoopConfig | null = null;
let _listeners: LoopListeners = {};
let _counter = 0;
let _running = false;
let _wifiEnabled = false; // mutable, toggled by setWifiEnabled()

// ============================================================
// Storage helpers
// ============================================================

function chainKey(sessionId: string): string {
  return `chain_${sessionId}`;
}

async function persistCounter(sessionId: string, counter: number): Promise<void> {
  try {
    const key = chainKey(sessionId);
    const existing = await AsyncStorage.getItem(key);
    let data: StoredChainData | null = existing ? JSON.parse(existing) : null;

    if (data) {
      data.counter = counter;
    } else if (_config) {
      data = {
        sessionId: _config.sessionId,
        seed: _config.seed,
        counter,
        studentId: _config.studentId,
      };
    } else {
      return;
    }

    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('❌ [verificationLoop] Failed to persist counter:', err);
  }
}

// ============================================================
// Lifecycle
// ============================================================

export function startLoop(config: LoopConfig, listeners: LoopListeners = {}): void {
  _config = { ...config };
  _listeners = listeners;
  _counter = 0;
  _running = false;
  // wifi starts disabled; caller MUST call setWifiEnabled(true) after enrollment
  _wifiEnabled = false;
  console.log(
    `🔁 [verificationLoop] Started (session=${config.sessionId}, wifi=${_wifiEnabled})`
  );
}

export function restoreLoop(
  config: LoopConfig,
  restoredCounter: number,
  listeners: LoopListeners = {}
): void {
  _config = { ...config };
  _listeners = listeners;
  _counter = restoredCounter;
  _running = false;
  // On restore, assume Wi-Fi was enabled if a template exists.
  // Caller can override with setWifiEnabled() after checking template info.
  _wifiEnabled = true;
  console.log(
    `🔁 [verificationLoop] Restored (session=${config.sessionId}, counter=${restoredCounter}, wifi=${_wifiEnabled})`
  );
}

export function stopLoop(): void {
  _config = null;
  _listeners = {};
  _counter = 0;
  _running = false;
  _wifiEnabled = false;
  console.log('🔁 [verificationLoop] Stopped');
}

export function isLoopRunning(): boolean {
  return _config !== null;
}

export function getCurrentCounter(): number {
  return _counter;
}

export function setWifiEnabled(enabled: boolean): void {
  _wifiEnabled = enabled;
  console.log(`🔁 [verificationLoop] wifiEnabled = ${enabled}`);
}

// ============================================================
// Continuity check
// ============================================================

async function runContinuity(): Promise<ContinuityResult> {
  if (!_config) {
    return {
      attempted: false,
      verified: false,
      counter: 0,
      message: 'Loop not started',
      error: 'not_started',
    };
  }

  const nextCounter = _counter + 1;
  try {
    const hash = await getCounterHash(_config.seed, nextCounter);
    const response = await studentAPI.verifyContinuity(_config.sessionId, hash);
    const data = response.data as {
      verified: boolean;
      message: string;
      current_index: number;
    };

    if (data.verified) {
      _counter = nextCounter;
      await persistCounter(_config.sessionId, nextCounter);
      const result: ContinuityResult = {
        attempted: true,
        verified: true,
        counter: nextCounter,
        message: `✅ Continuity #${nextCounter} verified (server counter: ${data.current_index})`,
      };
      _listeners.onContinuityResult?.(result);
      return result;
    }

    const result: ContinuityResult = {
      attempted: true,
      verified: false,
      counter: nextCounter,
      message: `❌ Continuity #${nextCounter} failed: ${data.message}`,
    };
    _listeners.onContinuityResult?.(result);
    return result;
  } catch (err: any) {
    const result: ContinuityResult = {
      attempted: true,
      verified: false,
      counter: nextCounter,
      message: `❌ Continuity #${nextCounter} network error`,
      error: err?.message || String(err),
    };
    _listeners.onContinuityResult?.(result);
    return result;
  }
}

// ============================================================
// Wi-Fi check
// ============================================================

async function runWifi(): Promise<WifiResult> {
  if (!_config || !_wifiEnabled) {
    return {
      attempted: false,
      verified: false,
      score: 0,
      anomaly: false,
      message: _config ? 'Wi-Fi disabled' : 'Loop not started',
    };
  }

  try {
    const envData = await captureEnvironment();
    if (envData.aps.length === 0) {
      const result: WifiResult = {
        attempted: true,
        verified: false,
        score: 0,
        anomaly: false,
        message: '⚠️ No APs seen — skipping',
      };
      _listeners.onWifiResult?.(result);
      return result;
    }

    const aps = toAPList(envData.aps);
    const response = await studentAPI.verifyWifi(_config.sessionId, aps);
    const data = response.data as {
      verified: boolean;
      similarity_score: number;
      is_anomaly: boolean;
      message: string;
      anomaly_id?: number | null;
    };

    const result: WifiResult = {
      attempted: true,
      verified: data.verified,
      score: data.similarity_score,
      anomaly: data.is_anomaly,
      message: data.verified
        ? `📶 Wi-Fi verified (score ${data.similarity_score.toFixed(2)})`
        : `📶 Wi-Fi anomaly (score ${data.similarity_score.toFixed(2)})${
            data.anomaly_id ? ` — flagged #${data.anomaly_id}` : ''
          }`,
      anomalyId: data.anomaly_id ?? null,
    };
    _listeners.onWifiResult?.(result);
    return result;
  } catch (err: any) {
    const result: WifiResult = {
      attempted: true,
      verified: false,
      score: 0,
      anomaly: false,
      message: '❌ Wi-Fi check network error',
      error: err?.message || String(err),
    };
    _listeners.onWifiResult?.(result);
    return result;
  }
}

// ============================================================
// One full cycle
// ============================================================

export async function runCycleOnce(reason: CycleReason = 'auto'): Promise<CycleResult> {
  const timestamp = Date.now();

  if (!_config) {
    return {
      reason,
      timestamp,
      continuity: {
        attempted: false,
        verified: false,
        counter: 0,
        message: 'Loop not started',
        error: 'not_started',
      },
      wifi: {
        attempted: false,
        verified: false,
        score: 0,
        anomaly: false,
        message: 'Loop not started',
        error: 'not_started',
      },
    };
  }

  if (_running) {
    console.log('🔁 [verificationLoop] Cycle already running, skipping');
    return {
      reason,
      timestamp,
      continuity: {
        attempted: false,
        verified: false,
        counter: _counter,
        message: 'Cycle already running',
      },
      wifi: {
        attempted: false,
        verified: false,
        score: 0,
        anomaly: false,
        message: 'Cycle already running',
      },
    };
  }

  _running = true;
  console.log(`🔁 [verificationLoop] Cycle start (${reason})`);

  try {
    const continuity = await runContinuity();
    const wifi = await runWifi();

    const result: CycleResult = { reason, timestamp, continuity, wifi };
    _listeners.onCycleComplete?.(result);
    return result;
  } finally {
    _running = false;
  }
}