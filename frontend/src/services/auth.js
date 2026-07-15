import api from './api'

export const verifyToken = async (token) => {
  try {
    const response = await api.get('/api/auth/verify', { params: { token } })
    return response.data
  } catch (error) {
    return { valid: false }
  }
}

export const logout = async (token) => {
  try {
    await api.post('/api/auth/logout', null, { params: { token } })
  } catch (error) {
    console.error('Logout error:', error)
  }
}