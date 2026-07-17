import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  ArrowLeftIcon, 
  MapPinIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon as RefreshIcon,
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const StudentAttendance = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [internship, setInternship] = useState(null)
  const [todayProofs, setTodayProofs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchProofs, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const dashboard = await api.get('/api/student/dashboard')
      setInternship(dashboard.data.active_internship)
      await fetchProofs()
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }

  const fetchProofs = async () => {
    try {
      const response = await api.get('/api/student/attendance/today')
      setTodayProofs(response.data.proofs || [])
    } catch (error) {
      console.error('Error fetching proofs:', error)
    }
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser')
      return
    }

    setLocationError(null)
    toast.loading('Getting your location...', { id: 'getLocation' })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss('getLocation')
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setLocation(newLocation)
        
        if (internship) {
          const distance = calculateDistance(
            newLocation.lat, newLocation.lng,
            internship.company_location.lat,
            internship.company_location.lng
          )
          
          if (distance <= internship.radius) {
            toast.success(`📍 Location captured! You're within ${Math.round(distance)}m of ${internship.company_name}`)
          } else {
            toast.warning(`⚠️ Location captured but you're ${Math.round(distance)}m away (Max allowed: ${internship.radius}m)`)
          }
        } else {
          toast.success('Location captured!')
        }
      },
      (error) => {
        toast.dismiss('getLocation')
        let errorMsg = 'Failed to get location'
        if (error.code === 1) errorMsg = 'Please allow location access in your browser'
        else if (error.code === 2) errorMsg = 'Location unavailable - try again'
        else if (error.code === 3) errorMsg = 'Location request timed out'
        
        setLocationError(errorMsg)
        toast.error(errorMsg)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const submitProof = async (type) => {
    if (!location) {
      toast.error('Please get your location first')
      return
    }

    if (!internship) {
      toast.error('No active internship')
      return
    }

    // Check location validity before submitting
    const distance = calculateDistance(
      location.lat, location.lng,
      internship.company_location.lat,
      internship.company_location.lng
    )
    
    const isWithinRadius = distance <= internship.radius
    
    if (!isWithinRadius) {
      toast.error(
        `❌ Cannot submit ${type} proof! You're ${Math.round(distance)}m away. ` +
        `Must be within ${internship.radius}m of ${internship.company_name}`,
        { duration: 8000 }
      )
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post('/api/student/attendance/submit', {
        internship_id: internship.internship_id,
        student_id: user.userId,
        latitude: location.lat,
        longitude: location.lng,
        proof_type: type
      })
      
      toast.success(`✅ ${type} proof submitted and verified! (${Math.round(distance)}m from company)`)
      await fetchProofs()
      setLocation(null)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!internship) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <button onClick={() => navigate('/student')} className="flex items-center text-gray-600 mb-4">
            <ArrowLeftIcon className="h-5 w-5 mr-1" />
            Back
          </button>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-yellow-800">No active internship found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => navigate('/student')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>

        {/* Internship Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{internship.company_name}</h2>
          <p className="text-gray-600">{internship.role_name}</p>
          {internship.is_test_mode && (
            <div className="mt-2 inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
              🎯 Demo Mode - {internship.test_duration_minutes} minute session
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-500">Working Hours</p>
              <p className="font-medium">{internship.daily_start} - {internship.daily_end}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Verification Radius</p>
              <p className="font-medium">{internship.radius} meters</p>
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Verification</h3>
          
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              📍 Company Location: {internship.company_location.lat.toFixed(6)}, {internship.company_location.lng.toFixed(6)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Your location must be within {internship.radius}m of this point for verification
            </p>
          </div>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={getCurrentLocation}
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <MapPinIcon className="h-5 w-5 mr-2" />
              Get My Location
            </button>
            <button
              onClick={() => fetchProofs()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>

          {locationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-800 text-sm">{locationError}</p>
            </div>
          )}

          {location && (
            <div className={`rounded-lg p-3 mb-4 ${locationError ? 'bg-red-50' : 'bg-green-50 border border-green-200'}`}>
              <p className={`font-medium ${locationError ? 'text-red-800' : 'text-green-800'}`}>
                {locationError ? '❌ Location Error' : '✅ Location Captured!'}
              </p>
              <p className="text-sm mt-1">
                Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
              </p>
              {internship && (
                <p className="text-xs mt-1 text-gray-600">
                  Distance from {internship.company_name}: {
                    calculateDistance(
                      location.lat, location.lng,
                      internship.company_location.lat,
                      internship.company_location.lng
                    ).toFixed(0)
                  } meters
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => submitProof('entry')}
              disabled={submitting || !location}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              📍 Entry Proof
            </button>
            <button
              onClick={() => submitProof('hourly')}
              disabled={submitting || !location}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              🕐 Hourly Proof
            </button>
            <button
              onClick={() => submitProof('exit')}
              disabled={submitting || !location}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              🚪 Exit Proof
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Today's Timeline</h3>
          </div>
          
          {todayProofs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No proofs recorded today
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {todayProofs.map((proof, idx) => (
                <div key={idx} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-mono font-bold text-gray-700 w-16">
                      {proof.time}
                    </div>
                    <div className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                      proof.verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {proof.type}
                    </div>
                    <div className="flex items-center gap-2">
                      {proof.verified ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-sm ${proof.verified ? 'text-green-600' : 'text-red-600'}`}>
                        {proof.verified 
                          ? `Verified (${Math.round(proof.distance)}m from company)` 
                          : `Failed - Outside radius (${Math.round(proof.distance)}m away)`}
                      </span>
                    </div>
                  </div>
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentAttendance