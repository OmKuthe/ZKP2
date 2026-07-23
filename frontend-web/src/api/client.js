// frontend-web/src/api/client.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ INTERCEPTOR: Add token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🔍 Sending request to:', config.url);
    console.log('🔍 Token from localStorage:', token ? token.substring(0, 20) + '...' : 'No token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token added to headers');
    } else {
      console.log('❌ No token found');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response from:', response.config.url, 'Status:', response.status);
    return response;
  },
  (error) => {
    console.log('❌ Error response from:', error.config?.url, 'Status:', error.response?.status);
    if (error.response?.status === 401) {
      console.log('🔴 401 Unauthorized - redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/manager/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/manager/login';
  },
  isAuthenticated: () => !!localStorage.getItem('token'),
};

export default api;