import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  PlusIcon, TrashIcon, ArrowLeftIcon, BriefcaseIcon,
  CalendarIcon, ClockIcon, UsersIcon, XMarkIcon, CheckIcon,
  PlayIcon, StopIcon, CogIcon, DocumentArrowUpIcon, CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const InternshipManagement = () => {
  const navigate = useNavigate()
  const [internships, setInternships] = useState([])
  const [companies, setCompanies] = useState([])
  const [managers, setManagers] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false)
  const [selectedInternship, setSelectedInternship] = useState(null)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [enableAutoFetch, setEnableAutoFetch] = useState(false)
  const [fetchInterval, setFetchInterval] = useState(1)
  const [calculatedDuration, setCalculatedDuration] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    company_id: '',
    role_name: '',
    description: '',
    manager_id: '',
    start_date: '',
    end_date: '',
    daily_start_time: '09:00',
    daily_end_time: '17:00',
    lunch_break_minutes: 60,
    is_paid: false,
    stipend_amount: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  // Calculate duration when times change
  useEffect(() => {
    calculateDuration()
  }, [formData.daily_start_time, formData.daily_end_time])

  const fetchData = async () => {
    try {
      const [internshipsRes, companiesRes, managersRes, studentsRes] = await Promise.all([
        api.get('/api/admin/internships/list', { params: { admin_token: 'admin_secret_key_2026' } }),
        api.get('/api/admin/companies/list', { params: { admin_token: 'admin_secret_key_2026' } }),
        api.get('/api/admin/managers/list', { params: { admin_token: 'admin_secret_key_2026' } }),
        api.get('/api/admin/students/list', { params: { admin_token: 'admin_secret_key_2026' } })
      ])
      
      setInternships(internshipsRes.data.internships || [])
      setCompanies(companiesRes.data.companies || [])
      setManagers(managersRes.data.managers || [])
      setStudents(studentsRes.data.students || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const calculateDuration = () => {
    const start = formData.daily_start_time
    const end = formData.daily_end_time
    
    if (start && end) {
      const [startHour, startMin] = start.split(':').map(Number)
      const [endHour, endMin] = end.split(':').map(Number)
      
      let startMinutes = startHour * 60 + startMin
      let endMinutes = endHour * 60 + endMin
      
      let duration = endMinutes - startMinutes
      if (duration < 0) duration += 24 * 60
      
      setCalculatedDuration(duration)
    }
  }

  const handleCreateInternship = async (e) => {
    e.preventDefault()
    
    const start = formData.daily_start_time
    const end = formData.daily_end_time
    
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    let startMinutes = startHour * 60 + startMin
    let endMinutes = endHour * 60 + endMin
    let duration = endMinutes - startMinutes
    if (duration < 0) duration += 24 * 60
    
    const payload = {
      ...formData,
      is_test_mode: enableAutoFetch ? 1 : 0,
      proof_interval_minutes: fetchInterval,
      total_minutes: duration
    }
    
    try {
      const response = await api.post('/api/admin/internships/create', payload, {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      
      const stipendMsg = formData.is_paid ? `, Stipend: ₹${formData.stipend_amount}` : ''
      toast.success(`Internship created! Duration: ${duration} minutes${stipendMsg}`)
      setShowModal(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create internship')
    }
  }

  const resetForm = () => {
    setFormData({
      company_id: '',
      role_name: '',
      description: '',
      manager_id: '',
      start_date: '',
      end_date: '',
      daily_start_time: '09:00',
      daily_end_time: '17:00',
      lunch_break_minutes: 60,
      is_paid: false,
      stipend_amount: 0
    })
    setEnableAutoFetch(false)
    setFetchInterval(1)
    setCalculatedDuration(0)
  }

  const handleActivateInternship = async (internshipId) => {
    try {
      await api.post(`/api/admin/internships/${internshipId}/activate`, null, {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      toast.success('Internship activated!')
      fetchData()
    } catch (error) {
      toast.error('Failed to activate')
    }
  }

  const handleDeleteInternship = async (internshipId) => {
    if (window.confirm('Delete this internship? This cannot be undone!')) {
      try {
        await api.delete(`/api/admin/internships/${internshipId}`, {
          params: { admin_token: 'admin_secret_key_2026' }
        })
        toast.success('Internship deleted')
        fetchData()
      } catch (error) {
        toast.error('Failed to delete')
      }
    }
  }

  const handleEnrollStudents = async () => {
    if (!selectedInternship || selectedStudents.length === 0) {
      toast.error('Select students first')
      return
    }

    try {
      const response = await api.post(`/api/admin/internships/${selectedInternship.internship_id}/enroll`, selectedStudents, {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      
      // Check if there were any failed enrollments
      if (response.data.failed && response.data.failed.length > 0) {
        toast.warning(`Enrolled ${response.data.enrolled || selectedStudents.length - response.data.failed.length} students. ${response.data.failed.length} failed: ${response.data.failed.join(', ')}`)
      } else {
        toast.success(`Enrolled ${selectedStudents.length} students successfully!`)
      }
      
      setShowEnrollModal(false)
      setSelectedStudents([])
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to enroll')
    }
  }

const handleBulkEnrollUpload = async (e) => {
  const file = e.target.files[0]
  if (!file || !selectedInternship) return

  const formData = new FormData()
  formData.append('file', file)

  setUploading(true)
  try {
    // FIX: Pass admin_token as query parameter correctly
    const response = await api.post(
      `/api/admin/internships/${selectedInternship.internship_id}/bulk-enroll`,
      formData,
      {
        params: { admin_token: 'admin_secret_key_2026' },  // This is correct
        headers: { 
          'Content-Type': 'multipart/form-data',
          // Also add the auth token if your API uses Bearer token
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    )
    
    const { enrolled_count, failed_count, failed_details } = response.data
    
    if (enrolled_count > 0) {
      toast.success(`✅ Successfully enrolled ${enrolled_count} students!`)
    }
    
    if (failed_count > 0) {
      console.log('Failed enrollments:', failed_details)
      toast.error(`⚠️ Failed to enroll ${failed_count} students. Check console for details.`)
    }
    
    setShowBulkEnrollModal(false)
    fetchData()
  } catch (error) {
    console.error('Bulk enrollment error:', error)
    toast.error(error.response?.data?.detail || 'Failed to upload file')
  } finally {
    setUploading(false)
    e.target.value = ''
  }
}

  const downloadEnrollmentTemplate = () => {
    const csvContent = 'student_id\nSTU001\nSTU002\nSTU003'
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'enrollment_template.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Template downloaded!')
  }

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    )
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'active': return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">✅ Active</span>
      case 'upcoming': return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">⏰ Upcoming</span>
      case 'completed': return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">📌 Completed</span>
      default: return <span className="px-2 py-1 text-xs rounded-full bg-gray-100">{status}</span>
    }
  }

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins} minutes`
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`
    return `${hours}h ${mins}m`
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
        <button onClick={() => navigate('/admin')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Internship Management</h2>
              <p className="text-gray-600">Create and manage internship programs</p>
            </div>
            <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Internship
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {internships.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No internships created yet.</div>
            ) : (
              internships.map((internship) => (
                <div key={internship.internship_id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <BriefcaseIcon className="h-5 w-5 text-indigo-600" />
                        <h3 className="text-lg font-semibold">{internship.company_name} - {internship.role_name}</h3>
                        {getStatusBadge(internship.status)}
                        {internship.is_paid && internship.stipend_amount > 0 && (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                            💰 ₹{internship.stipend_amount}/month
                          </span>
                        )}
                        {internship.is_test_mode && (
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                            ⚡ Auto-fetch: {internship.proof_interval_minutes}min
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">Manager: {internship.manager_id}</p>
                    </div>
                    <div className="flex gap-2">
                      {internship.status !== 'active' && internship.start_date > new Date().toISOString().split('T')[0] && (
                        <button disabled className="px-3 py-1 bg-gray-400 text-white text-sm rounded-md cursor-not-allowed">
                        <PlayIcon className="h-4 w-4 inline mr-1" />
                          Auto-activates on {internship.start_date}
                        </button>
                      )}
                      <button onClick={() => { setSelectedInternship(internship); setShowEnrollModal(true) }} className="px-3 py-1 border text-sm rounded-md hover:bg-gray-50">
                        <UsersIcon className="h-4 w-4 inline mr-1" />
                        Enroll ({internship.enrolled_students})
                      </button>
                      <button onClick={() => handleDeleteInternship(internship.internship_id)} className="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">
                        <TrashIcon className="h-4 w-4 inline mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center"><CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />{internship.start_date} to {internship.end_date}</div>
                    <div className="flex items-center"><ClockIcon className="h-4 w-4 text-gray-400 mr-2" />{internship.daily_hours}</div>
                    <div className="flex items-center"><CogIcon className="h-4 w-4 text-gray-400 mr-2" />Duration: {formatDuration(internship.test_duration_minutes)}</div>
                    <div className="flex items-center"><UsersIcon className="h-4 w-4 text-gray-400 mr-2" />{internship.enrolled_students} students</div>
                  </div>
                  
                  {internship.is_test_mode && (
                    <div className="mt-3 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      ⚡ Auto Location Fetch: Every {internship.proof_interval_minutes} minute(s)
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Internship Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white mb-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Create New Internship</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateInternship} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                  <select 
                    value={formData.company_id} 
                    onChange={(e) => setFormData({...formData, company_id: parseInt(e.target.value)})} 
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select Company</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Software Developer Intern" 
                    value={formData.role_name} 
                    onChange={(e) => setFormData({...formData, role_name: e.target.value})} 
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  placeholder="Internship description, requirements, etc." 
                  rows="3" 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager *</label>
                  <select 
                    value={formData.manager_id} 
                    onChange={(e) => setFormData({...formData, manager_id: e.target.value})} 
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" 
                    required
                  >
                    <option value="">Select Manager</option>
                    {managers.map(m => <option key={m.manager_id} value={m.manager_id}>{m.full_name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lunch Break (minutes)</label>
                  <input 
                    type="number" 
                    value={formData.lunch_break_minutes} 
                    onChange={(e) => setFormData({...formData, lunch_break_minutes: parseInt(e.target.value)})} 
                    className="w-full p-2 border rounded-md" 
                  />
                </div>
              </div>
              
              {/* Paid Internship Section */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input 
                    type="checkbox" 
                    checked={formData.is_paid} 
                    onChange={(e) => setFormData({...formData, is_paid: e.target.checked})} 
                    className="w-5 h-5 text-indigo-600 rounded" 
                  />
                  <div>
                    <span className="font-medium text-gray-700">Paid Internship</span>
                    <p className="text-xs text-gray-500">Student will receive stipend/salary</p>
                  </div>
                </label>
                
                {formData.is_paid && (
                  <div className="ml-7">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stipend Amount (₹ per month) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input 
                        type="number" 
                        min="0" 
                        step="1000"
                        placeholder="e.g., 15000" 
                        value={formData.stipend_amount} 
                        onChange={(e) => setFormData({...formData, stipend_amount: parseInt(e.target.value) || 0})} 
                        className="w-full p-2 pl-7 border rounded-md focus:ring-2 focus:ring-indigo-500" 
                        required={formData.is_paid}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Enter monthly stipend amount in Indian Rupees</p>
                  </div>
                )}
              </div>
              
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input 
                    type="date" 
                    value={formData.start_date} 
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
                    className="w-full p-2 border rounded-md" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input 
                    type="date" 
                    value={formData.end_date} 
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})} 
                    className="w-full p-2 border rounded-md" 
                    required 
                  />
                </div>
              </div>
              
              {/* Daily Schedule */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">Daily Schedule</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                    <input 
                      type="time" 
                      value={formData.daily_start_time} 
                      onChange={(e) => setFormData({...formData, daily_start_time: e.target.value})} 
                      className="w-full p-2 border rounded-md" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Time</label>
                    <input 
                      type="time" 
                      value={formData.daily_end_time} 
                      onChange={(e) => setFormData({...formData, daily_end_time: e.target.value})} 
                      className="w-full p-2 border rounded-md" 
                      required 
                    />
                  </div>
                </div>
                {calculatedDuration > 0 && (
                  <div className="mt-2 text-sm text-indigo-600 font-medium">
                    📊 Total Duration: {Math.floor(calculatedDuration / 60)}h {calculatedDuration % 60}m ({calculatedDuration} minutes)
                  </div>
                )}
              </div>
              
              {/* Auto Location Fetch Settings */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input 
                    type="checkbox" 
                    checked={enableAutoFetch} 
                    onChange={(e) => setEnableAutoFetch(e.target.checked)} 
                    className="w-4 h-4 text-indigo-600" 
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Auto Location Fetch</span>
                  <span className="text-xs text-gray-500">(Student's location will be automatically recorded)</span>
                </label>
                
                {enableAutoFetch && (
                  <div className="ml-6 bg-blue-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fetch Location Every:
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        min="0.5" 
                        max="60" 
                        step="0.5" 
                        value={fetchInterval} 
                        onChange={(e) => setFetchInterval(parseFloat(e.target.value))} 
                        className="w-24 p-2 border rounded-md text-center" 
                      />
                      <span className="text-gray-600">minute(s)</span>
                      {calculatedDuration > 0 && (
                        <span className="text-xs text-blue-600">
                          (Will record ~{Math.ceil(calculatedDuration / fetchInterval) + 2} proofs per session)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Tip: For testing/presentation, use 1 minute. For real internships, use 60 minutes.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 p-2 border rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Create Internship
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Students Modal - Updated with Bulk Upload */}
      {showEnrollModal && selectedInternship && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Enroll Students</h3>
                <p className="text-sm text-gray-600">{selectedInternship.company_name} - {selectedInternship.role_name}</p>
              </div>
              <button onClick={() => setShowEnrollModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            {/* Bulk Upload Button */}
            <div className="mb-4">
              <button
                onClick={() => { setShowEnrollModal(false); setShowBulkEnrollModal(true); }}
                className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                <DocumentArrowUpIcon className="h-4 w-4 mr-1" />
                Bulk Upload (CSV/Excel)
              </button>
            </div>
            
            <div className="mb-4 flex justify-between">
              <p>Selected: {selectedStudents.length} students</p>
              <button onClick={() => setSelectedStudents([])} className="text-red-600 text-sm">Clear All</button>
            </div>
            
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              {students.map((student) => (
                <div 
                  key={student.student_id} 
                  onClick={() => toggleStudentSelection(student.student_id)} 
                  className={`flex justify-between p-3 cursor-pointer hover:bg-gray-50 border-b ${selectedStudents.includes(student.student_id) ? 'bg-indigo-50' : ''}`}
                >
                  <div>
                    <p className="font-medium">{student.full_name}</p>
                    <p className="text-sm text-gray-500">{student.student_id} - {student.roll_number}</p>
                  </div>
                  {selectedStudents.includes(student.student_id) && <CheckIcon className="h-5 w-5 text-indigo-600" />}
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowEnrollModal(false)} className="flex-1 p-2 border rounded-md">Cancel</button>
              <button onClick={handleEnrollStudents} disabled={selectedStudents.length === 0} className="flex-1 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                Enroll ({selectedStudents.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Enrollment Modal */}
      {showBulkEnrollModal && selectedInternship && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Bulk Enroll Students</h3>
                <p className="text-sm text-gray-600">{selectedInternship.company_name} - {selectedInternship.role_name}</p>
              </div>
              <button onClick={() => setShowBulkEnrollModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">📋 Required Column:</p>
                <p className="text-xs text-blue-700 font-mono">student_id</p>
                <p className="text-xs text-gray-500 mt-1">(One student ID per row)</p>
                <button
                  onClick={downloadEnrollmentTemplate}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  📥 Download Template CSV
                </button>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleBulkEnrollUpload}
                  disabled={uploading}
                  className="hidden"
                  id="bulk-enroll-input"
                />
                <label
                  htmlFor="bulk-enroll-input"
                  className="cursor-pointer inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {uploading ? 'Uploading...' : 'Choose File'}
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: CSV, Excel (.xlsx, .xls)
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkEnrollModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InternshipManagement