// frontend-web/src/pages/ManagerCreateInternship.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

const ManagerCreateInternship = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    // Company
    company_name: '',
    geofence_center_lat: '',
    geofence_center_lng: '',
    geofence_radius: '2.0',
    
    // Internship
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    daily_start_time: '09:00',
    daily_end_time: '17:00',
    is_paid: false,
    stipend_amount: '',
  });

  // Fetch existing companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await api.get('/admin/companies');
        setCompanies(response.data.companies || []);
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };
    fetchCompanies();
  }, []);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setMessage('📍 Getting current location...');
    
    if (!navigator.geolocation) {
      setMessage('❌ Geolocation is not supported');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          geofence_center_lat: position.coords.latitude.toFixed(6),
          geofence_center_lng: position.coords.longitude.toFixed(6),
        });
        setMessage('✅ Location captured!');
        setGettingLocation(false);
      },
      (error) => {
        setMessage(`❌ Error: ${error.message}`);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // 1. Create Company
      const companyData = {
        name: formData.company_name,
        geofence_center_lat: parseFloat(formData.geofence_center_lat),
        geofence_center_lng: parseFloat(formData.geofence_center_lng),
        geofence_radius: parseFloat(formData.geofence_radius),
      };
      
      const companyRes = await api.post('/admin/companies', companyData);
      const companyId = companyRes.data.id;
      setMessage(`✅ Company "${formData.company_name}" created!`);

      // 2. Create Internship
      const internshipData = {
        company_id: companyId,
        name: formData.name,
        description: formData.description,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        daily_start_time: formData.daily_start_time,
        daily_end_time: formData.daily_end_time,
        is_paid: formData.is_paid,
        stipend_amount: formData.is_paid ? parseFloat(formData.stipend_amount) : null,
      };

      const internshipRes = await api.post('/admin/internships/', internshipData);
      
      setMessage(`✅ Internship "${formData.name}" created successfully!`);
      
      // Navigate to internship details
      setTimeout(() => {
        navigate(`/manager/internships/${internshipRes.data.id}`);
      }, 1500);

    } catch (error) {
      setMessage(`❌ Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/manager" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create Internship</h1>
          <p className="text-sm text-slate-500">Create a new internship with company details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Section */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">🏢 Company Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Geofence Radius (km) *</label>
              <input
                type="number"
                step="0.1"
                value={formData.geofence_radius}
                onChange={(e) => setFormData({ ...formData, geofence_radius: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Latitude *</label>
              <input
                type="number"
                step="0.0001"
                value={formData.geofence_center_lat}
                onChange={(e) => setFormData({ ...formData, geofence_center_lat: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Longitude *</label>
              <input
                type="number"
                step="0.0001"
                value={formData.geofence_center_lng}
                onChange={(e) => setFormData({ ...formData, geofence_center_lng: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
          </div>
          
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={gettingLocation}
            className="mt-3 btn-secondary text-sm"
          >
            {gettingLocation ? '📍 Getting location...' : '📍 Use Current Location'}
          </button>
        </div>

        {/* Internship Section */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">💼 Internship Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Internship Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                rows="2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily Start Time *</label>
              <input
                type="time"
                value={formData.daily_start_time}
                onChange={(e) => setFormData({ ...formData, daily_start_time: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily End Time *</label>
              <input
                type="time"
                value={formData.daily_end_time}
                onChange={(e) => setFormData({ ...formData, daily_end_time: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4">💰 Payment Details</h3>
          
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.is_paid}
              onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
            />
            <label className="text-sm font-medium text-slate-700">This is a paid internship</label>
          </div>

          {formData.is_paid && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stipend Amount (₹/month) *</label>
              <input
                type="number"
                step="1000"
                value={formData.stipend_amount}
                onChange={(e) => setFormData({ ...formData, stipend_amount: e.target.value })}
                className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="e.g., 15000"
                required={formData.is_paid}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        {message && (
          <div className={`p-3 rounded-lg ${
            message.includes('✅') ? 'bg-success-50 text-success-700' : 
            message.includes('❌') ? 'bg-danger-50 text-danger-700' : 
            'bg-slate-50 text-slate-600'
          }`}>
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? 'Creating...' : 'Create Internship'}
          </button>
          <Link to="/manager" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ManagerCreateInternship;