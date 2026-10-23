// zkattend-mobile/app/services/foregroundService.ts
/**
 * Foreground service wrapper around @notifee/react-native.
 *
 * IMPORTANT: The 60s tick and quota guard use react-native-nitro-keepalive-timer
 * instead of the global setInterval/setTimeout. React Native's JS timers are
 * frozen by Android when the screen locks — the native timers from this module
 * keep firing through screen lock, which is required for continuous verification.
 *
 * Reference: https://www.npmjs.com/package/react-native-nitro-keepalive-timer
 */
import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidForegroundServiceType,
} from '@notifee/react-native';
import {
  setInterval as keepaliveSetInterval,
  clearInterval as keepaliveClearInterval,
  setTimeout as keepaliveSetTimeout,
  clearTimeout as keepaliveClearTimeout,
} from 'react-native-nitro-keepalive-timer';

import { runCycleOnce, isLoopRunning } from './verificationLoop';

// ============================================================
// Constants
// ============================================================

const NOTIFICATION_ID = 'zkattend-verification';
const CHANNEL_ID = 'zkattend_verification';
const TICK_INTERVAL_MS = 60_000; // 60s
const QUOTA_GUARD_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000; // 5h45m

// ============================================================
// Public types
// ============================================================

export interface ForegroundServiceOptions {
  onQuotaWarning?: () => void;
  onServiceStopped?: (reason: 'manual' | 'quota' | 'loop_stopped') => void;
}

// ============================================================
// Internal state
// ============================================================

let _tickTimer: any = null;
let _quotaTimer: any = null;
let _opts: ForegroundServiceOptions = {};
let _running = false;
let _registered = false;

// ============================================================
// Foreground service runner registration
// ============================================================

/**
 * Register the notifee foreground service runner.
 *
 * MUST be called exactly once, in index.ts, BEFORE registerRootComponent.
 * The runner's returned Promise must never resolve — that keeps the
 * service alive for the lifetime of the app until stopForegroundService().
 */
export function registerForegroundServiceTask(): void {
  if (Platform.OS !== 'android') return;
  if (_registered) return;

  notifee.registerForegroundService(() => {
    console.log('🔔 [foregroundService] Runner attached');
    return new Promise(() => {
      // Intentionally never resolves. Service lives until stopForegroundService().
    });
  });

  _registered = true;
  console.log('🔔 [foregroundService] Runner registered');
}

// ============================================================
// Helpers
// ============================================================

async function ensureChannel(): Promise<string> {
  return notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Attendance Verification',
    importance: AndroidImportance.LOW,
    vibration: false,
    lights: false,
  });
}

function clearTimers(): void {
  if (_tickTimer !== null) {
    try { keepaliveClearInterval(_tickTimer); } catch {}
    _tickTimer = null;
  }
  if (_quotaTimer !== null) {
    try { keepaliveClearTimeout(_quotaTimer); } catch {}
    _quotaTimer = null;
  }
}

// ============================================================
// Public API
// ============================================================

export function isForegroundServiceRunning(): boolean {
  return _running;
}

export async function startForegroundVerification(
  opts: ForegroundServiceOptions = {}
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.log('🔔 [foregroundService] Skipping on non-Android');
    return false;
  }

  if (_running) {
    console.log('🔔 [foregroundService] Already running');
    return true;
  }

  if (!_registered) {
    console.error(
      '❌ [foregroundService] Runner not registered. Call registerForegroundServiceTask() in index.ts.'
    );
    return false;
  }

  if (!isLoopRunning()) {
    console.warn(
      '⚠️ [foregroundService] Refusing to start: verificationLoop not started'
    );
    return false;
  }

  _opts = opts;

  try {
    const channelId = await ensureChannel();

    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'ZKAttend — Attendance Active',
      body: 'Verifying your presence every 60s. Tap to open.',
      android: {
        channelId,
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        showTimestamp: false,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        ],
        pressAction: { id: 'default' },
        smallIcon: 'ic_launcher',
      },
    });

    // ✅ Native timer — fires through screen lock
    _tickTimer = keepaliveSetInterval(() => {
      runCycleOnce('auto').catch((err) => {
        console.error('❌ [foregroundService] Cycle error:', err);
      });
    }, TICK_INTERVAL_MS);

    // ✅ Native timer — quota guard
    _quotaTimer = keepaliveSetTimeout(async () => {
      console.warn(
        '⏳ [foregroundService] Quota guard fired (5h45m). Stopping cleanly.'
      );
      try {
        _opts.onQuotaWarning?.();
      } catch (err) {
        console.error('❌ [foregroundService] onQuotaWarning threw:', err);
      }
      await stopForegroundVerification('quota');
    }, QUOTA_GUARD_MS);

    _running = true;
    console.log('🔔 [foregroundService] Started (native timers)');
    return true;
  } catch (err) {
    console.error('❌ [foregroundService] Failed to start:', err);
    clearTimers();
    _running = false;
    return false;
  }
}

export async function stopForegroundVerification(
  reason: 'manual' | 'quota' | 'loop_stopped' = 'manual'
): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!_running) {
    console.log('🔔 [foregroundService] Not running, nothing to stop');
    return;
  }

  clearTimers();

  try {
    await notifee.stopForegroundService();
  } catch (err) {
    console.warn('⚠️ [foregroundService] stopForegroundService threw:', err);
  }

  try {
    await notifee.cancelNotification(NOTIFICATION_ID);
  } catch (err) {
    console.warn('⚠️ [foregroundService] cancelNotification threw:', err);
  }

  _running = false;
  console.log(`🔔 [foregroundService] Stopped (${reason})`);

  try {
    _opts.onServiceStopped?.(reason);
  } catch (err) {
    console.error('❌ [foregroundService] onServiceStopped threw:', err);
  }
}

export async function stopEverything(
  reason: 'manual' | 'quota' | 'loop_stopped' = 'manual'
): Promise<void> {
  await stopForegroundVerification(reason);
  const { stopLoop } = require('./verificationLoop');
  stopLoop();
}