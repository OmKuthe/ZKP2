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
} as const;

// Storage keys
export const STORAGE_KEYS = {
  STUDENT_ID: '@zkattend_student_id',
  TOKEN: '@zkattend_token',
} as const;