// app/utils/constants.ts

// App constants
export const APP_NAME = 'ZKAttend';
export const APP_VERSION = '1.0.0';

// API endpoints
export const API_ENDPOINTS = {
  LOGIN: '/auth/login',
  STUDENT_DASHBOARD: '/student/dashboard',
  VERIFY_LOCATION: '/student/verify-location',
  STUDENT_ENTRY: '/student/entry',
  STUDENT_EXIT: '/student/exit',
  ACTIVE_SESSION: '/session/active',
  WIFI_ENROLL: '/wifi/enroll',
  WIFI_VERIFY: '/wifi/verify',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  STUDENT_ID: '@zkattend_student_id',
  TOKEN: '@zkattend_token',
} as const;

// ============================================================
// Wi-Fi Fingerprinting config
// ============================================================
export const WIFI_CONFIG = {
  /** How many scan rounds to take during enrollment */
  ENROLL_SCAN_ROUNDS: 3,
  /** Delay between enrollment scans (ms) */
  ENROLL_SCAN_INTERVAL_MS: 5000,
  /** Minimum unique APs for a valid template */
  MIN_APS_FOR_TEMPLATE: 6,
  /** How often to run a Wi-Fi check during an active session (ms) */
  VERIFY_INTERVAL_MS: 60_000, // 1 minute
} as const;