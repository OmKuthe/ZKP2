import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  TrashIcon, 
  UserPlusIcon, 
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const ManagerManagement = () => {
  const navigate = useNavigate()
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    manager_id: '',
    email: '',
    full_name: '',
    designation: '',
    department: '',
    phone_number: '',
    password: ''
  })

  useEffect(() => {
    fetchManagers()
  }, [])

  const fetchManagers = async () => {
    try {
      const response = await api.get('/api/admin/managers/list', {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      setManagers(response.data.managers)
    } catch (error) {
      console.error('Error fetching managers:', error)
      toast.error('Failed to load managers')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateManager = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/admin/managers/create', formData, {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      toast.success('Manager created successfully!')
      setShowModal(false)
      setFormData({
        manager_id: '',
        email: '',
        full_name: '',
        designation: '',
        department: '',
        phone_number: '',
        password: ''
      })
      fetchManagers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create manager')
    }
  }

  const handleDeleteManager = async (managerId) => {
    if (window.confirm(`Are you sure you want to delete manager ${managerId}?`)) {
      try {
        await api.delete(`/api/admin/managers/${managerId}`, {
          params: { admin_token: 'admin_secret_key_2026' }
        })
        toast.success('Manager deleted successfully!')
        fetchManagers()
      } catch (error) {
        toast.error('Failed to delete manager')
      }
    }
  }

  const filteredManagers = managers.filter(manager =>
    manager.manager_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    manager.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    manager.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manager Management</h2>
              <p className="text-gray-600">Manage faculty and coordinators</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search managers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <UserPlusIcon className="h-5 w-5 mr-2" />
                Add Manager
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredManagers.map((manager) => (
                  <tr key={manager.manager_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{manager.manager_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{manager.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{manager.designation}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{manager.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{manager.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{manager.phone_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleDeleteManager(manager.manager_id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredManagers.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No managers found
            </div>
          )}
        </div>
      </div>

      {/* Create Manager Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Manager</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateManager} className="space-y-4">
              <input
                type="text"
                placeholder="Manager ID *"
                value={formData.manager_id}
                onChange={(e) => setFormData({...formData, manager_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <input
                type="email"
                placeholder="Email *"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <input
                type="text"
                placeholder="Full Name *"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <input
                type="text"
                placeholder="Designation *"
                value={formData.designation}
                onChange={(e) => setFormData({...formData, designation: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <input
                type="text"
                placeholder="Department *"
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                value={formData.phone_number}
                onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <input
                type="password"
                placeholder="Password *"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              
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

export default ManagerManagement