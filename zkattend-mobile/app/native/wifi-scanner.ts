// zkattend-mobile/app/native/wifi-scanner.ts
/**
 * Real Wi-Fi scanner using react-native-wifi-reborn.
 *
 * Strategy:
 *   1. Primary: loadWifiList() — reads the OS's cached scan results (no rate limit)
 *   2. Fallback: reScanAndLoadWifiList() — triggers fresh scan (rate-limited on Android 9+)
 *
 * Android 9+ restricts scanning to 4 scans per 2 minutes in foreground.
 * Using the cache avoids this restriction entirely.
 */
import WifiManager from 'react-native-wifi-reborn';
import { Platform, PermissionsAndroid } from 'react-native';

export interface ScannedAP {
  bssid: string;
  rssi: number;
  frequency?: number;
  capabilities?: string;
}

/**
 * Request the runtime permissions needed for Wi-Fi scanning.
 */
export async function requestWifiPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const sdkVersion = Platform.Version as number;

    if (sdkVersion >= 33) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
      ]);
      const fine = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const nearby = result[PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES];
      return (
        fine === PermissionsAndroid.RESULTS.GRANTED &&
        nearby === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (error) {
    console.error('❌ Failed to request Wi-Fi permissions:', error);
    return false;
  }
}

/**
 * Robustly extract a list of network objects from whatever shape
 * react-native-wifi-reborn returns.
 *
 * Handles:
 *   - Array directly
 *   - { networks: [...] }
 *   - Warning string (Android rate limit message) → returns []
 *   - null / undefined → returns []
 */
function extractNetworkArray(raw: any): any[] {
  // Guard: null/undefined
  if (raw === null || raw === undefined) {
    return [];
  }

  // Guard: string (this is the Android rate limit warning)
  if (typeof raw === 'string') {
    console.warn('⚠️ Android returned a warning string instead of scan results:', raw);
    return [];
  }

  // Case 1: raw is already an array
  if (Array.isArray(raw)) {
    return raw;
  }

  // Case 2: { networks: [...] }
  if (raw && Array.isArray(raw.networks)) {
    return raw.networks;
  }

  // Case 3: { wifiList: [...] }
  if (raw && Array.isArray(raw.wifiList)) {
    return raw.wifiList;
  }

  // Case 4: { results: [...] }
  if (raw && Array.isArray(raw.results)) {
    return raw.results;
  }

  // Case 5: single AP object
  if (raw && typeof raw === 'object' && (raw.BSSID || raw.bssid)) {
    return [raw];
  }

  // Unknown shape
  if (raw && typeof raw === 'object') {
    console.warn('⚠️ Unknown scan return shape. Keys:', Object.keys(raw));
  }
  return [];
}

/**
 * Convert a raw network object into a ScannedAP.
 */
function toScannedAP(n: any): ScannedAP | null {
  if (!n) return null;
  const bssid = n.BSSID || n.bssid;
  const level = n.level !== undefined ? n.level : n.rssi;
  if (!bssid || level === undefined) return null;

  return {
    bssid: String(bssid).toUpperCase(),
    rssi: Number(level),
    frequency: n.frequency ? Number(n.frequency) : undefined,
    capabilities: n.capabilities || undefined,
  };
}

/**
 * Try to load the OS's cached Wi-Fi scan list.
 * This does NOT trigger a new scan, so it's not rate-limited.
 */
async function tryLoadCachedList(): Promise<ScannedAP[]> {
  try {
    console.log('📶 Trying loadWifiList (cached)...');
    const raw: any = await WifiManager.loadWifiList();
    const networks = extractNetworkArray(raw);
    console.log(`📶 Cached list: ${networks.length} networks`);
    return networks
      .map(toScannedAP)
      .filter((ap): ap is ScannedAP => ap !== null);
  } catch (error) {
    console.warn('⚠️ loadWifiList failed:', error);
    return [];
  }
}

/**
 * Trigger a fresh scan via reScanAndLoadWifiList.
 * Rate-limited on Android 9+ (4 scans per 2 minutes).
 */
async function tryFreshScan(): Promise<ScannedAP[]> {
  try {
    console.log('📶 Trying reScanAndLoadWifiList (fresh)...');
    const raw: any = await WifiManager.reScanAndLoadWifiList();
    const networks = extractNetworkArray(raw);
    console.log(`📶 Fresh scan: ${networks.length} networks`);
    return networks
      .map(toScannedAP)
      .filter((ap): ap is ScannedAP => ap !== null);
  } catch (error) {
    console.warn('⚠️ reScanAndLoadWifiList failed:', error);
    return [];
  }
}

/**
 * Scan for nearby Wi-Fi access points.
 *
 * 1. First tries the cached list (fast, no rate limit)
 * 2. Falls back to a fresh scan if the cache is empty
 */
export async function scanWifiNetworks(): Promise<ScannedAP[]> {
  try {
    const hasPermission = await requestWifiPermissions();
    if (!hasPermission) {
      console.warn('⚠️ Wi-Fi permissions not granted');
      return [];
    }

    // Try the cache first — no rate limit
    let aps = await tryLoadCachedList();

    // If cache is empty, try a fresh scan
    if (aps.length === 0) {
      console.log('📶 Cache empty, attempting fresh scan...');
      aps = await tryFreshScan();
    }

    // Sort by signal strength (strongest first)
    aps.sort((a, b) => b.rssi - a.rssi);

    console.log(`📶 Scan result: ${aps.length} APs`);
    return aps;
  } catch (error) {
    console.error('❌ Wi-Fi scan failed:', error);
    return [];
  }
}

/**
 * Take multiple scans over a short period.
 *
 * IMPORTANT: We now space scans out to respect Android 9+'s rate limit.
 * Each scan uses the cache, so no new scans are triggered unless needed.
 */
export async function scanMultipleTimes(
  count: number = 3,
  intervalMs: number = 5000  // 5 seconds between scans
): Promise<ScannedAP[][]> {
  const allScans: ScannedAP[][] = [];

  for (let i = 0; i < count; i++) {
    console.log(`📶 Scan ${i + 1}/${count}...`);
    const scan = await scanWifiNetworks();
    allScans.push(scan);

    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return allScans;
}