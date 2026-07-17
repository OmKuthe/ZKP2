import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowLeftIcon,
  CalendarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const HolidayManagement = () => {
  const navigate = useNavigate()
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    description: ''
  })

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    try {
      const response = await api.get('/api/admin/holidays/list', {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      setHolidays(response.data.holidays)
    } catch (error) {
      console.error('Error fetching holidays:', error)
      toast.error('Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateHoliday = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/admin/holidays/create', formData, {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      toast.success('Holiday added successfully!')
      setShowModal(false)
      setFormData({ date: '', name: '', description: '' })
      fetchHolidays()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add holiday')
    }
  }

  const handleDeleteHoliday = async (date) => {
    if (window.confirm(`Delete holiday on ${date}?`)) {
      try {
        await api.delete(`/api/admin/holidays/${date}`, {
          params: { admin_token: 'admin_secret_key_2026' }
        })
        toast.success('Holiday deleted successfully!')
        fetchHolidays()
      } catch (error) {
        toast.error('Failed to delete holiday')
      }
    }
  }

  // Group holidays by month
  const holidaysByMonth = holidays.reduce((acc, holiday) => {
    const month = new Date(holiday.date).toLocaleString('default', { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(holiday)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
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
              <h2 className="text-2xl font-bold text-gray-900">Holiday Management</h2>
              <p className="text-gray-600">Manage holidays and non-working days</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Holiday
            </button>
          </div>

          {holidays.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No holidays added yet. Click "Add Holiday" to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {Object.entries(holidaysByMonth).map(([month, monthHolidays]) => (
                <div key={month}>
                  <div className="px-6 py-3 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">{month}</h3>
                  </div>
                  {monthHolidays.map((holiday) => (
                    <div key={holiday.date} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                      <div className="flex items-start gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-2xl font-bold text-indigo-600">
                            {new Date(holiday.date).getDate()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(holiday.date).toLocaleString('default', { weekday: 'short' })}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{holiday.name}</p>
                          {holiday.description && (
                            <p className="text-sm text-gray-500">{holiday.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(holiday.date)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Holiday Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Holiday</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateHoliday} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Republic Day, Diwali"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Additional details about the holiday"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="3"
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
                  Add Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default HolidayManagement