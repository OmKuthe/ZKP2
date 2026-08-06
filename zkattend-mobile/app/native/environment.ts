// zkattend-mobile/app/native/environment.ts
import * as Location from 'expo-location';
import * as Network from 'expo-network';

export interface EnvironmentData {
  bssids: string[];
  ssids: string[];
  timestamp: number;
}

/**
 * Capture current environment — simplified version
 * Uses location + network state
 */
export async function captureEnvironment(): Promise<EnvironmentData> {
  try {
    const features: string[] = [];

    // 1. Get location (rounded to 2 decimal places ≈ 1.1km)
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // Round to 2 decimal places (≈ 1.1km) — low precision for privacy
      const lat = location.coords.latitude.toFixed(2);
      const lng = location.coords.longitude.toFixed(2);
      features.push(`loc_${lat}_${lng}`);
      console.log(`📍 Location: ${lat}, ${lng}`);
    } else {
      features.push('no_location');
    }

    // 2. Get network state
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (networkState.isConnected) {
        features.push('connected');
      }
      if (networkState.type) {
        features.push(`type_${networkState.type}`);
      }
    } catch (e) {
      features.push('no_network');
    }

    // 3. Always return something
    if (features.length === 0) {
      features.push('default_env');
    }

    console.log(`📶 Environment captured: ${features.length} features`);

    return {
      bssids: features,
      ssids: [],
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('❌ Failed to capture environment:', error);
    // Return a fallback so flow continues
    return {
      bssids: ['fallback'],
      ssids: [],
      timestamp: Date.now(),
    };
  }
}

export function isEnvironmentCaptureAvailable(): boolean {
  return true;
}