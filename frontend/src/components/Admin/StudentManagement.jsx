import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  ArrowLeftIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const StudentManagement = () => {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    student_id: '',
    email: '',
    full_name: '',
    roll_number: '',
    course: '',
    year: '',
    semester: '',
    phone_number: '',
    department: '',
    password: ''
  })

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const response = await api.get('/api/admin/students/list', {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      setStudents(response.data.students)
    } catch (error) {
      console.error('Error fetching students:', error)
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/admin/students/create', formData, {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      toast.success('Student created successfully!')
      setShowModal(false)
      setFormData({
        student_id: '',
        email: '',
        full_name: '',
        roll_number: '',
        course: '',
        year: '',
        semester: '',
        phone_number: '',
        department: '',
        password: ''
      })
      fetchStudents()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create student')
    }
  }

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const response = await api.post('/api/admin/students/bulk-upload', formData, {
        params: { admin_token: 'admin_secret_key_2026' },
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const { created, errors } = response.data
      if (errors.length > 0) {
        toast.error(`${created} students created. ${errors.length} errors. Check console.`)
        console.error('Upload errors:', errors)
      } else {
        toast.success(`Successfully created ${created} students!`)
      }
      
      setShowBulkModal(false)
      fetchStudents()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteStudent = async (studentId) => {
    if (window.confirm(`Are you sure you want to delete student ${studentId}?`)) {
      try {
        await api.delete(`/api/admin/students/${studentId}`, {
          params: { admin_token: 'admin_secret_key_2026' }
        })
        toast.success('Student deleted successfully!')
        fetchStudents()
      } catch (error) {
        toast.error('Failed to delete student')
      }
    }
  }

  const downloadTemplate = () => {
    const headers = ['student_id', 'email', 'full_name', 'roll_number', 'course', 'year', 'semester', 'phone_number', 'department']
    const csvContent = headers.join(',') + '\n' + 
      'STU001,student1@example.com,John Doe,2021001,BCA,3,5,9876543210,Computer Science\n' +
      'STU002,student2@example.com,Jane Smith,2021002,BCA,3,5,9876543211,Electronics'
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'student_template.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Template downloaded!')
  }

  const filteredStudents = students.filter(student =>
    student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.roll_number?.toLowerCase().includes(searchTerm.toLowerCase())
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
              <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
              <p className="text-gray-600">Manage all students in the system</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
                Bulk Upload
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <UserPlusIcon className="h-5 w-5 mr-2" />
                Add Student
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Internship</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{student.student_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.roll_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.course}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.semester}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.department || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.phone_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.current_internship || 'None'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.total_hours || 0} hrs</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleDeleteStudent(student.student_id)}
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
          
          {filteredStudents.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No students found
            </div>
          )}
        </div>
      </div>

      {/* Create Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Student</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateStudent} className="space-y-4 max-h-96 overflow-y-auto">
              <input
                type="text"
                placeholder="Student ID *"
                value={formData.student_id}
                onChange={(e) => setFormData({...formData, student_id: e.target.value})}
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
                placeholder="Roll Number *"
                value={formData.roll_number}
                onChange={(e) => setFormData({...formData, roll_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <input
                type="text"
                placeholder="Course *"
                value={formData.course}
                onChange={(e) => setFormData({...formData, course: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Year *"
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                <input
                  type="number"
                  placeholder="Semester *"
                  value={formData.semester}
                  onChange={(e) => setFormData({...formData, semester: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
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
                placeholder="Password (optional)"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bulk Upload Students</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">📋 Required Columns:</p>
                <p className="text-xs text-blue-700 font-mono">
                  student_id, email, full_name, roll_number, course, year, semester, phone_number, department
                </p>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  📥 Download Template CSV
                </button>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleBulkUpload}
                  disabled={uploading}
                  className="hidden"
                  id="bulk-file-input"
                />
                <label
                  htmlFor="bulk-file-input"
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
                  onClick={() => setShowBulkModal(false)}
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

export default StudentManagement