// zkattend-mobile/app/api/client.ts
import axios from 'axios';

// Path A: local testing. Revert to 'https://zkp2.onrender.com/api' for prod.
// 10.0.2.2 = Android emulator's alias for host machine's 127.0.0.1
// Physical device: use your PC's LAN IP, e.g. http://192.168.1.42:8001/api
export const API_URL = 'https://zkp2.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  console.log(`📡 ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.log(
      `❌ ${error.config?.url} - ${error.response?.status || error.message}`
    );
    return Promise.reject(error);
  }
);

// ==================== Student API ====================

export const studentAPI = {
  getDashboard: (studentId: string) =>
    api.get(`/student/dashboard?student_id=${studentId}`),

  startEntry: (studentId: string, latitude: number, longitude: number) =>
    api.post('/student/start-entry', {
      student_id: studentId,
      latitude,
      longitude,
    }),

  completeEntry: (
    studentId: string,
    companyId: number,
    qrToken: string,
    faceVerified?: boolean | null
  ) =>
    api.post('/student/complete-entry', {
      student_id: studentId,
      company_id: companyId,
      qr_token: qrToken,
      face_verified: faceVerified ?? null,
    }),

  startExit: (studentId: string, latitude: number, longitude: number) =>
    api.post('/student/start-exit', {
      student_id: studentId,
      latitude,
      longitude,
    }),

  completeExit: (
    studentId: string,
    companyId: number,
    qrToken: string,
    hashLink?: string
  ) =>
    api.post('/student/complete-exit', {
      student_id: studentId,
      company_id: companyId,
      qr_token: qrToken,
      hash_chain_link: hashLink,
    }),

  getActiveSession: (studentId: string) =>
    api.get(`/student/active-session/${studentId}`),

  verifyContinuity: (sessionId: string, hashLink: string) =>
    api.post('/student/verify-continuity', {
      session_id: sessionId,
      hash_link: hashLink,
      timestamp: Math.floor(Date.now() / 1000),
    }),

  storeEnvironment: (sessionId: string, commitment: string) =>
    api.post('/student/store-environment', {
      session_id: sessionId,
      commitment: commitment,
      timestamp: Math.floor(Date.now() / 1000),
    }),

  verifyEnvironment: (sessionId: string, commitment: string) =>
    api.post('/student/verify-environment', {
      session_id: sessionId,
      current_commitment: commitment,
      timestamp: Math.floor(Date.now() / 1000),
    }),

  getContinuityChecks: (sessionId: string) =>
    api.get(`/student/session/checks/${sessionId}`),

  getHistory: (studentId: string) => api.get(`/history/${studentId}`),

  // ============================================================
  // Wi-Fi Fingerprinting API
  // ============================================================

  enrollWifi: (
    sessionId: string,
    scans: Array<
      Array<{
        bssid: string;
        rssi: number;
        frequency?: number;
        capabilities?: string;
      }>
    >
  ) =>
    api.post('/wifi/enroll', {
      session_id: sessionId,
      scans,
    }),

  verifyWifi: (
    sessionId: string,
    scan: Array<{
      bssid: string;
      rssi: number;
      frequency?: number;
      capabilities?: string;
    }>
  ) =>
    api.post('/wifi/verify', {
      session_id: sessionId,
      scan,
    }),

  getWifiTemplate: (sessionId: string) =>
    api.get(`/wifi/template/${sessionId}`),

  getWifiVerifications: (sessionId: string) =>
    api.get(`/wifi/verifications/${sessionId}`),

  // ============================================================
  // V2: Presence challenges (Phase 4b)
  // ============================================================

  /**
   * Poll for a pending re-verify challenge. Called once per heartbeat cycle.
   * Returns { pending: false } if there's nothing to do.
   */
  getPendingChallenge: (studentId: string) =>
    api.get(`/v2/challenges/pending?student_id=${studentId}`),

  /**
   * Report the outcome of a re-verify.
   * @param passed  true = student verified, false = student failed
   * @param note    optional human note (e.g. "blink detection failed")
   */
  respondToChallenge: (
    challengeId: number,
    passed: boolean,
    note?: string
  ) =>
    api.post(`/v2/challenges/${challengeId}/respond`, {
      passed,
      note: note ?? null,
    }),

    // Append to studentAPI object (inside the existing studentAPI = { ... }):

  // ============================================================
  // V2: Read endpoints (Phase 5 — History / Calendar screens)
  // ============================================================

  /**
   * Fetch a student's session history.
   * @param params.limit  default 20
   * @param params.page   default 1
   * @param params.from   optional YYYY-MM-DD (inclusive)
   * @param params.to     optional YYYY-MM-DD (inclusive)
   * @param params.status optional 'active' | 'closed' | 'flagged' | 'abandoned'
   */
  sessions: (
    studentId: string,
    params?: {
      limit?: number;
      page?: number;
      from?: string;
      to?: string;
      status?: string;
    }
  ) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.page) qs.append('page', String(params.page));
    if (params?.from) qs.append('from', params.from);
    if (params?.to) qs.append('to', params.to);
    if (params?.status) qs.append('status', params.status);
    const query = qs.toString();
    return api.get(
      `/v2/students/${studentId}/sessions${query ? `?${query}` : ''}`
    );
  },

  /**
   * Fetch a student's per-day calendar for a month.
   * @param month  'YYYY-MM'
   */
  calendar: (studentId: string, month: string) =>
    api.get(`/v2/students/${studentId}/calendar?month=${month}`),

};

export default api;