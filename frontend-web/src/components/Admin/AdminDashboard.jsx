import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  AcademicCapIcon, 
  UsersIcon, 
  BuildingOfficeIcon,
  CalendarIcon,
  UserGroupIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ArrowPathIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const AdminDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    total_students: 0,
    total_managers: 0,
    active_internships: 0,
    total_internships: 0,
    today_attendance: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/admin/dashboard/stats', {
        params: { admin_token: 'admin_secret_key_2026' }
      })
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menuItems = [
    { title: 'Manage Students', icon: UsersIcon, path: '/admin/students', color: 'bg-blue-500', description: 'Add, edit, or remove students' },
    { title: 'Manage Managers', icon: UserGroupIcon, path: '/admin/managers', color: 'bg-green-500', description: 'Manage faculty and coordinators' },
    { title: 'Companies', icon: BuildingOfficeIcon, path: '/admin/companies', color: 'bg-purple-500', description: 'Manage company locations' },
    { title: 'Internships', icon: BriefcaseIcon, path: '/admin/internships', color: 'bg-orange-500', description: 'Create and assign internships' },
    { title: 'Holidays', icon: CalendarIcon, path: '/admin/holidays', color: 'bg-pink-500', description: 'Manage holidays and breaks' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <AcademicCapIcon className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">ZKAttend Admin</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchStats}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Refresh"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-700">Welcome, {user.fullName}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_students}</p>
              </div>
              <UsersIcon className="h-10 w-10 text-blue-500 opacity-50" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Managers</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_managers}</p>
              </div>
              <UserGroupIcon className="h-10 w-10 text-green-500 opacity-50" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Internships</p>
                <p className="text-3xl font-bold text-gray-900">{stats.active_internships}</p>
              </div>
              <BriefcaseIcon className="h-10 w-10 text-orange-500 opacity-50" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Internships</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_internships}</p>
              </div>
              <CalendarIcon className="h-10 w-10 text-purple-500 opacity-50" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Attendance</p>
                <p className="text-3xl font-bold text-gray-900">{stats.today_attendance}</p>
              </div>
              <ChartBarIcon className="h-10 w-10 text-yellow-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/admin/students')}
              className="flex items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <PlusCircleIcon className="h-8 w-8 text-indigo-600 mr-3" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Add New Student</p>
                <p className="text-sm text-gray-600">Enroll a new student</p>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/admin/managers')}
              className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <PlusCircleIcon className="h-8 w-8 text-green-600 mr-3" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Add New Manager</p>
                <p className="text-sm text-gray-600">Create manager account</p>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/admin/internships')}
              className="flex items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <PlusCircleIcon className="h-8 w-8 text-orange-600 mr-3" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Create Internship</p>
                <p className="text-sm text-gray-600">Setup new internship program</p>
              </div>
            </button>
          </div>
        </div>

        {/* Management Cards */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {menuItems.map((item) => (
            <button
              key={item.title}
              onClick={() => navigate(item.path)}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all text-left group"
            >
              <div className={`inline-flex p-3 rounded-full ${item.color} bg-opacity-10 mb-4 group-hover:scale-110 transition-transform`}>
                <item.icon className={`h-6 w-6 ${item.color.replace('bg-', 'text-')}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard