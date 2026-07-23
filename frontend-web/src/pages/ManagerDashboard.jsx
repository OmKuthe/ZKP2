// frontend-web/src/pages/ManagerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';  // ✅ Make sure this import is correct

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [internships, setInternships] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalStudents: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      console.log('📡 Fetching dashboard...');
      const response = await api.get('/manager/dashboard');
      console.log('✅ Dashboard response:', response.data);
      
      const data = response.data;
      setInternships(data.internships || []);
      
      const active = data.internships?.filter(i => i.status === 'active').length || 0;
      const totalStudents = data.internships?.reduce((sum, i) => sum + (i.student_count || 0), 0) || 0;
      
      setStats({
        total: data.internships?.length || 0,
        active: active,
        totalStudents: totalStudents
      });
    } catch (error) {
      console.error('❌ Error fetching dashboard:', error);
      setError(error.response?.data?.detail || 'Failed to load dashboard');
      
      // If 401, redirect to login
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/manager/login');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-danger-600">{error}</p>
        <button onClick={fetchDashboard} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  // ... rest of your dashboard JSX
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Manage your internships and students</p>
        </div>
        <Link to="/manager/internships/create" className="btn-primary">
          + Create Internship
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-slate-500">Total Internships</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Active Internships</p>
          <p className="text-2xl font-bold text-success-600">{stats.active}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total Students</p>
          <p className="text-2xl font-bold text-primary-600">{stats.totalStudents}</p>
        </div>
      </div>

      {/* Internships List */}
      {internships.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400">No internships created yet.</p>
          <Link to="/manager/internships/create" className="text-primary-600 hover:underline mt-2 inline-block">
            Create your first internship →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {internships.map((internship) => (
            <div key={internship.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{internship.name}</h3>
                  <p className="text-sm text-slate-500">{internship.company_name}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  internship.status === 'active' 
                    ? 'bg-success-500/10 text-success-600' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {internship.status || 'Active'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-slate-500">Students:</span>
                  <span className="font-medium ml-1">{internship.student_count || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500">Timings:</span>
                  <span className="font-medium ml-1">
                    {internship.daily_start_time || '09:00'} - {internship.daily_end_time || '17:00'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-medium ml-1">
                    {new Date(internship.start_date).toLocaleDateString()} - {new Date(internship.end_date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {internship.is_paid && (
                <div className="text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded mb-2">
                  💰 Stipend: ₹{internship.stipend_amount}/month
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <Link
                  to={`/manager/internships/${internship.id}`}
                  className="btn-primary text-sm px-4 py-1.5"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;