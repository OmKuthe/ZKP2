// frontend-web/src/components/ManagerLayout.jsx
import React, { useEffect } from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';

const ManagerLayout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/manager/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/manager/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-6">
              <span className="text-xl font-bold text-primary-600">ZKAttend</span>
              <span className="text-sm text-slate-500">Manager Portal</span>
              
              {/* Navigation Links */}
              <div className="flex items-center gap-4 ml-4">
                <Link to="/manager" className="text-sm text-slate-600 hover:text-primary-600">
                  Dashboard
                </Link>
                <Link to="/manager/students" className="text-sm text-slate-600 hover:text-primary-600">
                  Students
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-700">Welcome, Admin</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </div>
    </div>
  );
};

export default ManagerLayout;