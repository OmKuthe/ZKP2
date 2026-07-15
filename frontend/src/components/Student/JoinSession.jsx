import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  MapPinIcon, 
  QrCodeIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import api from '../../services/api'

const JoinSession = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sessionNonce, setSessionNonce] = useState('')
  const [session, setSession] = useState(location.state?.session || null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)
  const [locationStatus, setLocationStatus] = useState(null)
  const [studentLocation, setStudentLocation] = useState(null)

  useEffect(() => {
    if (session) {
      setSessionNonce(session.session_nonce)
    }
  }, [session])

  const fetchSession = async () => {
    if (!sessionNonce) return
    setLoading(true)
    try {
      const response = await api.get(`/api/session/${sessionNonce}`)
      setSession(response.data)
    } catch (error) {
      alert('Session not found!')
    } finally {
      setLoading(false)
    }
  }

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus({ error: 'Geolocation not supported' })
      return
    }

    setLocationStatus({ loading: true })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setStudentLocation(location)
        setLocationStatus({ success: true, location })
      },
      (error) => {
        setLocationStatus({ error: error.message })
      }
    )
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const submitAttendance = async () => {
    if (!studentLocation) {
      alert('Please get your location first')
      return
    }

    // Calculate distance from class center
    const distance = calculateDistance(
      studentLocation.lat,
      studentLocation.lng,
      session.class_center_lat,
      session.class_center_lng
    )

    if (distance > session.radius_meters) {
      setResult({
        success: false,
        message: `You are ${Math.round(distance)}m away from class. Maximum allowed: ${session.radius_meters}m`
      })
      return
    }

    setVerifying(true)
    
    // For now, create a mock ZK proof
    // In production, you would generate actual ZK proof using snarkjs
    const mockProof = {
      proof: {
        pi_a: ["0", "0", "0"],
        pi_b: [["0", "0"], ["0", "0"]],
        pi_c: ["0", "0", "0"],
        protocol: "groth16",
        curve: "bn128"
      },
      public_signals: [
        session.class_center_lat.toString(),
        session.class_center_lng.toString(),
        (session.radius_meters * session.radius_meters).toString()
      ]
    }

    try {
      const response = await api.post('/api/attendance/submit', {
        session_nonce: session.session_nonce,
        student_id: user.userId,
        zk_proof: mockProof.proof,
        public_signals: mockProof.public_signals,
        location_lat: studentLocation.lat,
        location_lng: studentLocation.lng
      })

      if (response.data.verified) {
        setResult({
          success: true,
          message: 'Attendance marked successfully!',
          record_id: response.data.record_id
        })
        setTimeout(() => navigate('/student'), 2000)
      } else {
        setResult({
          success: false,
          message: 'Verification failed. Please try again.'
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: error.response?.data?.detail || 'Error submitting attendance'
      })
    } finally {
      setVerifying(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
          <button
            onClick={() => navigate('/student')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-1" />
            Back to Dashboard
          </button>
          
          <h2 className="text-2xl font-bold mb-4">Join Session</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Code
              </label>
              <input
                type="text"
                value={sessionNonce}
                onChange={(e) => setSessionNonce(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter session code"
              />
            </div>
            
            <button
              onClick={fetchSession}
              disabled={loading || !sessionNonce}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Fetch Session'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <button
          onClick={() => navigate('/student')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Join Session</h2>
            <p className="text-indigo-100 text-sm">Session: {session.session_nonce.slice(0, 16)}...</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Session Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Session Details</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Faculty:</strong> {session.faculty_id}</p>
                <p><strong>Department:</strong> {session.department || 'General'}</p>
                <p><strong>Start Time:</strong> {new Date(session.start_time).toLocaleString()}</p>
                <p><strong>End Time:</strong> {new Date(session.end_time).toLocaleString()}</p>
                <p><strong>Class Center:</strong> {session.class_center_lat.toFixed(6)}, {session.class_center_lng.toFixed(6)}</p>
                <p><strong>Radius:</strong> {session.radius_meters} meters</p>
              </div>
            </div>

            {/* Location Section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Location Verification</h3>
              
              {!studentLocation ? (
                <button
                  onClick={getLocation}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <MapPinIcon className="h-5 w-5 mr-2" />
                  Get My Current Location
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center text-green-800">
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      <span>Location captured!</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      Lat: {studentLocation.lat.toFixed(6)}, Lng: {studentLocation.lng.toFixed(6)}
                    </p>
                  </div>
                  
                  {session && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        Distance from class: {
                          calculateDistance(
                            studentLocation.lat, studentLocation.lng,
                            session.class_center_lat, session.class_center_lng
                          ).toFixed(0)
                        } meters
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Maximum allowed: {session.radius_meters} meters
                      </p>
                    </div>
                  )}
                </div>
              )}

              {locationStatus?.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  Error: {locationStatus.error}
                </div>
              )}
            </div>

            {/* Submit Button */}
            {studentLocation && !result && (
              <button
                onClick={submitAttendance}
                disabled={verifying}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Submit Attendance'}
              </button>
            )}

            {/* Result Message */}
            {result && (
              <div className={`rounded-lg p-4 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center">
                  {result.success ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <span className={result.success ? 'text-green-800' : 'text-red-800'}>
                    {result.message}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default JoinSession