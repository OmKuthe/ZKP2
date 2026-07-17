import React, { createContext, useState, useContext, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
      // Set default auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    setLoading(false)
  }, [])

  const login = async (userType, credentials) => {
    try {
      let endpoint = ''
      if (userType === 'admin') {
        endpoint = '/api/auth/admin/login'
      } else if (userType === 'manager') {
        endpoint = '/api/auth/manager/login'
      } else {
        endpoint = '/api/auth/student/login'
      }

      const response = await api.post(endpoint, credentials)
      const { token, user_type, user_id, full_name } = response.data
      
      const userData = { token, userType: user_type, userId: user_id, fullName: full_name }
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(userData)
      
      toast.success(`Welcome ${full_name}!`)
      return { success: true, userType: user_type }
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    toast.success('Logged out successfully')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}