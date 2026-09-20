// zkattend-mobile/app/native/environment.ts
/**
 * Environment capture — now uses REAL Wi-Fi scanning.
 *
 * This module replaces the old GPS-based placeholder.
 * It captures the measurable Wi-Fi environment around the user.
 */
import {
  scanWifiNetworks,
  scanMultipleTimes,
  requestWifiPermissions,
  ScannedAP,
} from './wifi-scanner';

export interface EnvironmentData {
  /** List of nearby access points (real Wi-Fi data) */
  aps: ScannedAP[];
  /** When the capture happened */
  timestamp: number;
  /** How many scan rounds were performed */
  scan_rounds: number;
  /** Whether the data is considered usable */
  is_usable: boolean;
}

/**
 * Capture a single Wi-Fi environment snapshot.
 * Used for periodic verification during an active session.
 */
export async function captureEnvironment(): Promise<EnvironmentData> {
  try {
    const aps = await scanWifiNetworks();
    const is_usable = aps.length >= 1;

    console.log(
      `📶 Environment captured: ${aps.length} APs (usable: ${is_usable})`
    );

    return {
      aps,
      timestamp: Date.now(),
      scan_rounds: 1,
      is_usable,
    };
  } catch (error) {
    console.error('❌ Failed to capture environment:', error);
    return {
      aps: [],
      timestamp: Date.now(),
      scan_rounds: 0,
      is_usable: false,
    };
  }
}

/**
 * Capture a robust template for enrollment.
 * Takes multiple scans over a short window and returns them all.
 * The backend will aggregate them (median RSSI per AP).
 */
export async function captureTemplate(
  scanCount: number = 3,
  intervalMs: number = 2000
): Promise<EnvironmentData> {
  try {
    const scans = await scanMultipleTimes(scanCount, intervalMs);
    const allAps = scans.flat();

    const uniqueBssids = new Set(allAps.map((ap) => ap.bssid));
    const is_usable = uniqueBssids.size >= 6;

    console.log(
      `📶 Template captured: ${scans.length} rounds, ${uniqueBssids.size} unique APs (usable: ${is_usable})`
    );

    return {
      aps: allAps,
      timestamp: Date.now(),
      scan_rounds: scans.length,
      is_usable,
    };
  } catch (error) {
    console.error('❌ Failed to capture template:', error);
    return {
      aps: [],
      timestamp: Date.now(),
      scan_rounds: 0,
      is_usable: false,
    };
  }
}

/**
 * Check whether Wi-Fi scanning is available on this platform.
 */
export function isEnvironmentCaptureAvailable(): boolean {
  const { Platform } = require('react-native');
  return Platform.OS === 'android';
}

/**
 * Ask for permissions before any capture.
 */
export async function ensureEnvironmentPermissions(): Promise<boolean> {
  return await requestWifiPermissions();
}

export type { ScannedAP };