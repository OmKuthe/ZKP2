import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  UserCircleIcon, 
  KeyIcon, 
  AcademicCapIcon, 
  BuildingOfficeIcon,
  ShieldCheckIcon 
} from '@heroicons/react/24/outline'

const Login = () => {
  const [userType, setUserType] = useState('student')
  const [credentials, setCredentials] = useState({ 
    student_id: '', 
    manager_id: '', 
    admin_id: '', 
    password: '' 
  })
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    let loginCredentials = {}
    if (userType === 'student') {
      loginCredentials = { student_id: credentials.student_id }
    } else if (userType === 'manager') {
      loginCredentials = { manager_id: credentials.manager_id, password: credentials.password }
    } else {
      loginCredentials = { admin_id: credentials.admin_id, password: credentials.password }
    }

    const result = await login(userType, loginCredentials)
    
    if (result.success) {
      navigate(`/${userType}`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-4">
            <AcademicCapIcon className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">ZKAttend</h2>
          <p className="text-gray-600 mt-2">Internship Attendance System</p>
        </div>

        {/* Role Selection */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'student', label: 'Student', icon: UserCircleIcon },
            { id: 'manager', label: 'Manager', icon: BuildingOfficeIcon },
            { id: 'admin', label: 'Admin', icon: ShieldCheckIcon }
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => setUserType(role.id)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                userType === role.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <role.icon className="h-4 w-4" />
              {role.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {userType === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student ID
              </label>
              <div className="relative">
                <UserCircleIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={credentials.student_id}
                  onChange={(e) => setCredentials({ ...credentials, student_id: e.target.value })}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your student ID"
                  required
                />
              </div>
            </div>
          )}

          {(userType === 'manager' || userType === 'admin') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {userType === 'admin' ? 'Admin ID' : 'Manager ID'}
                </label>
                <div className="relative">
                  <BuildingOfficeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userType === 'admin' ? credentials.admin_id : credentials.manager_id}
                    onChange={(e) => setCredentials({ 
                      ...credentials, 
                      [userType === 'admin' ? 'admin_id' : 'manager_id']: e.target.value 
                    })}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={`Enter your ${userType} ID`}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="font-medium">Demo Credentials:</p>
          <div className="mt-2 space-y-1 text-xs">
            <p>👨‍💼 Admin: admin / admin123</p>
            <p>👨‍🏫 Manager: (Create via admin first)</p>
            <p>👨‍🎓 Student: (Create via admin first)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login