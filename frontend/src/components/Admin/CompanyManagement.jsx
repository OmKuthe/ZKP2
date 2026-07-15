import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const CompanyManagement = () => {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius_meters: 200
  })

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/api/admin/companies/list', {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      setCompanies(response.data.companies)
    } catch (error) {
      console.error('Error fetching companies:', error)
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCompany = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/admin/companies/create', formData, {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      toast.success('Company created successfully!')
      setShowModal(false)
      setFormData({
        name: '',
        address: '',
        latitude: '',
        longitude: '',
        radius_meters: 200
      })
      fetchCompanies()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create company')
    }
  }

  const handleDeleteCompany = async (companyId) => {
    if (window.confirm('Are you sure you want to delete this company? This will also delete all associated internships.')) {
      try {
        await api.delete(`/api/admin/companies/${companyId}`, {
          params: { admin_token: 'admin_secret_key_2026' }
        })
        toast.success('Company deleted successfully!')
        fetchCompanies()
      } catch (error) {
        toast.error('Failed to delete company')
      }
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        toast.success('Location captured!')
      },
      (error) => {
        toast.error('Failed to get location: ' + error.message)
      }
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Company Management</h2>
              <p className="text-gray-600">Manage company locations and geofence settings</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Company
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {companies.map((company) => (
              <div key={company.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                    <BuildingOfficeIcon className="h-6 w-6 text-indigo-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                  </div>
                  <button
                    onClick={() => handleDeleteCompany(company.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{company.address}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-500">
                    <MapPinIcon className="h-4 w-4 mr-2" />
                    <span>Lat: {company.latitude.toFixed(6)}, Lng: {company.longitude.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <span className="font-medium mr-2">Radius:</span>
                    <span>{company.radius} meters</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {companies.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No companies added yet. Click "Add Company" to get started.
            </div>
          )}
        </div>
      </div>

      {/* Create Company Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Company</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <input
                type="text"
                placeholder="Company Name *"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              
              <input
                type="text"
                placeholder="Address *"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude *"
                  value={formData.latitude}
                  onChange={(e) => setFormData({...formData, latitude: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude *"
                  value={formData.longitude}
                  onChange={(e) => setFormData({...formData, longitude: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <button
                type="button"
                onClick={getCurrentLocation}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Use Current Location
              </button>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Geofence Radius (meters)
                </label>
                <input
                  type="number"
                  placeholder="Radius in meters"
                  value={formData.radius_meters}
                  onChange={(e) => setFormData({...formData, radius_meters: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="10"
                  max="1000"
                  required
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyManagement