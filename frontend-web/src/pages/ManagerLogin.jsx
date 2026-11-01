// frontend-web/src/pages/ManagerLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const ManagerLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

    const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { username, password });
      
      console.log('✅ Login successful:', response.data);
      
      // Store token
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('role', response.data.role);
      
      // ✅ Force a hard redirect so App.jsx reads the new token from localStorage
      window.location.href = '/manager';
      
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100/30">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">ZKAttend</h1>
          <p className="text-slate-500 mt-1">Manager Login</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-400">
          Use: admin / admin@123
        </div>
      </div>
    </div>
  );
};

export default ManagerLogin;