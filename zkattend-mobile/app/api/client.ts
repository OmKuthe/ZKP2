// app/api/client.ts
import axios from 'axios';

export const API_URL = 'http://192.168.1.174:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Add logging
api.interceptors.request.use(config => {
  console.log(`📡 ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

api.interceptors.response.use(
  response => {
    console.log(`✅ ${response.config.url} - ${response.status}`);
    return response;
  },
  error => {
    console.log(`❌ ${error.config?.url} - ${error.response?.status || error.message}`);
    return Promise.reject(error);
  }
);

// ==================== Student API ====================

export const studentAPI = {
  // Get dashboard
  getDashboard: (studentId: string) => 
    api.get(`/student/dashboard?student_id=${studentId}`),
  
  // Start entry with GPS
  startEntry: (studentId: string, latitude: number, longitude: number) =>
    api.post('/student/start-entry', { 
      student_id: studentId, 
      latitude, 
      longitude 
    }),
  
  // Complete entry with QR
  completeEntry: (studentId: string, companyId: number, qrToken: string) =>
    api.post('/student/complete-entry', {
      student_id: studentId,
      company_id: companyId,
      qr_token: qrToken
    }),
  
  // Start exit with GPS
  startExit: (studentId: string, latitude: number, longitude: number) =>
    api.post('/student/start-exit', {
      student_id: studentId,
      latitude,
      longitude
    }),
  
  // Complete exit with QR
  completeExit: (studentId: string, companyId: number, qrToken: string) =>
    api.post('/student/complete-exit', {
      student_id: studentId,
      company_id: companyId,
      qr_token: qrToken
    }),
  
  // Get active session
  getActiveSession: (studentId: string) =>
    api.get(`/student/active-session/${studentId}`)
};

export default api;