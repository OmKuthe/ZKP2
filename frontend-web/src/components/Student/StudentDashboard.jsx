import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  AcademicCapIcon, 
  ClockIcon, 
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  StopIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

const StudentDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoTracking, setAutoTracking] = useState(false)
  const [trackingInterval, setTrackingInterval] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [todayProofs, setTodayProofs] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [calendarData, setCalendarData] = useState({})
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
  const checkPendingProofs = async () => {
    const pendingProofs = JSON.parse(localStorage.getItem('pending_proofs') || '[]');
    if (pendingProofs.length > 0 && navigator.onLine) {
      await syncPendingProofs();
    }
  };
  
  checkPendingProofs();
  
  // Listen for online/offline events
  const handleOnline = () => {
    console.log('🌐 Internet connection restored');
    syncPendingProofs();
  };
  
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}, []);

  useEffect(() => {
    fetchDashboard()
    fetchTodayProofs()
    fetchCalendarData()
    
    // Check for active tracking
    const savedTracking = localStorage.getItem('autoTracking')
    const savedStartTime = localStorage.getItem('sessionStartTime')
    
    if (savedTracking === 'true' && savedStartTime) {
      setAutoTracking(true)
      setSessionStartTime(parseInt(savedStartTime))
      const timerInterval = startElapsedTimer(parseInt(savedStartTime))
      return () => clearInterval(timerInterval)
    }
  }, [])

  // Auto-refresh dashboard every 30 seconds to check if start button should be enabled
  useEffect(() => {
    if (!autoTracking && dashboard?.active_internship) {
      const interval = setInterval(() => {
        fetchDashboard()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [autoTracking, dashboard])

  const startElapsedTimer = (startTime) => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setElapsedSeconds(elapsed)
    }, 1000)
    return interval
  }

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/api/student/dashboard')
      console.log('Dashboard:', response.data)
      setDashboard(response.data)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchTodayProofs = async () => {
    try {
      const response = await api.get('/api/student/attendance/today')
      setTodayProofs(response.data.proofs || [])
    } catch (error) {
      console.error('Error fetching proofs:', error)
    }
  }

  const fetchCalendarData = async () => {
    try {
      const response = await api.get(`/api/student/attendance/calendar?year=${selectedYear}&month=${selectedMonth + 1}`)
      setCalendarData(response.data.attendance || {})
    } catch (error) {
      console.error('Error fetching calendar:', error)
      // Don't show toast error for calendar - it's optional
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

  const submitProof = async (proofType, location) => {
  // Get internship ID from dashboard data
  const internship = dashboard?.active_internship;
  
  if (!internship) {
    toast.error('No active internship found');
    return false;
  }

  const payload = {
    internship_id: internship.internship_id,  // Fixed: use internship from dashboard
    student_id: user.userId,                  // Fixed: use user.userId
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    proof_type: proofType
  };
  
  setSubmitting(true);
  
  try {
    const response = await api.post('/api/student/attendance/submit', payload);
    
    // Refresh data after successful submission
    await fetchTodayProofs();
    await fetchDashboard();
    
    if (response.data.verified) {
      toast.success(`✓ ${proofType} verified!`);
      return true;
    } else {
      toast.error(`✗ ${proofType} failed - outside geofence`);
      return false;
    }
  } catch (error) {
    console.error('Proof submission failed:', error);
    
    if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      // Save offline for later sync (simplified for now)
      toast.info('📱 Proof saved locally. Will sync when internet returns.');
      // Store in localStorage for later sync
      const pendingProofs = JSON.parse(localStorage.getItem('pending_proofs') || '[]');
      pendingProofs.push({ ...payload, timestamp: new Date().toISOString() });
      localStorage.setItem('pending_proofs', JSON.stringify(pendingProofs));
      return true; // Assume success for tracking continuity
    }
    
    toast.error(error.response?.data?.detail || 'Submission failed');
    return false;
  } finally {
    setSubmitting(false);
  }
};


  const startAutoTracking = async () => {
    const internship = dashboard?.active_internship
    
    // Check if can start
    if (!internship?.can_start) {
      toast.error(internship?.status_message || 'Cannot start session now')
      return
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }

    const intervalMinutes = internship.proof_interval_minutes || 1
    const totalMinutes = internship.total_minutes || 60
    
    toast.success(`Starting session at ${new Date().toLocaleTimeString()}`)
    
    // Submit entry proof
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await submitProof('entry', position)
        
        const startTime = Date.now()
        setSessionStartTime(startTime)
        localStorage.setItem('sessionStartTime', startTime.toString())
        
        const timerInterval = startElapsedTimer(startTime)
        
        let proofCount = 1
        let exitSubmitted = false
        
        const interval = setInterval(async () => {
          proofCount++
          
          // Check if session should end
          const currentTime = new Date()
          const currentHour = currentTime.getHours()
          const currentMinute = currentTime.getMinutes()
          const endHour = parseInt(internship.daily_end.split(':')[0])
          const endMinute = parseInt(internship.daily_end.split(':')[1])
          
          const shouldEnd = (currentHour > endHour) || 
                           (currentHour === endHour && currentMinute >= endMinute)
          
          if (shouldEnd && !exitSubmitted) {
            exitSubmitted = true
            clearInterval(interval)
            clearInterval(timerInterval)
            
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                await submitProof('exit', pos)
                toast.success('Session completed!')
                setAutoTracking(false)
                setTrackingInterval(null)
                localStorage.removeItem('autoTracking')
                localStorage.removeItem('sessionStartTime')
                setElapsedSeconds(0)
              },
              (err) => console.error(err)
            )
            return
          }
          
          // Submit periodic check
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              await submitProof('hourly', position)
              await fetchTodayProofs()
            },
            (error) => console.error('Location error:', error)
          )
        }, intervalMinutes * 60 * 1000)
        
        setTrackingInterval(interval)
        setAutoTracking(true)
        localStorage.setItem('autoTracking', 'true')
      },
      (error) => {
        toast.error('Could not get location')
      }
    )
  }

  const stopAutoTracking = async () => {
    if (trackingInterval) {
      clearInterval(trackingInterval)
      setTrackingInterval(null)
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await submitProof('exit', position)
        await fetchTodayProofs()
        setAutoTracking(false)
        localStorage.removeItem('autoTracking')
        localStorage.removeItem('sessionStartTime')
        setElapsedSeconds(0)
        toast.success('Session stopped')
      },
      (error) => {
        toast.error('Could not submit exit proof')
      }
    )
  }
  // Sync pending proofs when internet is back
const syncPendingProofs = async () => {
  const pendingProofs = JSON.parse(localStorage.getItem('pending_proofs') || '[]');
  if (pendingProofs.length === 0) return;
  
  console.log(`🔄 Syncing ${pendingProofs.length} pending proofs...`);
  
  for (const proof of pendingProofs) {
    try {
      await api.post('/api/student/attendance/submit', proof);
      console.log(`✅ Synced proof from ${proof.timestamp}`);
    } catch (error) {
      console.log(`❌ Failed to sync proof, will retry later`);
      return; // Stop if one fails, retry remaining later
    }
  }
  
  // Clear synced proofs
  localStorage.removeItem('pending_proofs');
  toast.success('Offline proofs synced successfully!');
  await fetchTodayProofs();
  await fetchDashboard();
};
  const handleLogout = () => {
    if (autoTracking) {
      stopAutoTracking()
    }
    logout()
    navigate('/login')
  }

  const changeMonth = async (increment) => {
    let newMonth = selectedMonth + increment
    let newYear = selectedYear
    
    if (newMonth < 0) {
      newMonth = 11
      newYear--
    } else if (newMonth > 11) {
      newMonth = 0
      newYear++
    }
    
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    
    try {
      const response = await api.get(`/api/student/attendance/calendar?year=${newYear}&month=${newMonth + 1}`)
      setCalendarData(response.data.attendance || {})
    } catch (error) {
      console.error('Error fetching calendar:', error)
    }
  }

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay()
  }

  // Calculate today's total completed time (from proofs, not live tracking)
  const todayTotalHours = todayProofs.length > 0 ? (todayProofs.length * 0.5) : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const internship = dashboard?.active_internship
  const totalMinutes = internship?.total_minutes || 0
  const elapsedMinutes = Math.min(Math.floor(elapsedSeconds / 60), totalMinutes)
  const remainingMinutes = Math.max(totalMinutes - elapsedMinutes, 0)
  const progressPercent = totalMinutes > 0 ? (elapsedMinutes / totalMinutes) * 100 : 0
  const today = new Date()

  // FIX: Use local time getters instead of toISOString() which converts to UTC first.
  // toISOString() would return the wrong date in IST after 18:30 UTC (= midnight IST).
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <AcademicCapIcon className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">ZKAttend</span>
              <span className="ml-2 text-sm text-gray-500">Student Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {dashboard?.student?.full_name || user.fullName}</span>
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
        {/* Two Time Cards - Today's Total Time (completed) + Live Tracking Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Today's Total Time (Completed) */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <ClockIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Today's Total Time</p>
                <p className="text-3xl font-bold text-gray-900">
                  {todayTotalHours.toFixed(1)} hrs
                </p>
                <p className="text-xs text-gray-400">Based on verified proofs</p>
              </div>
            </div>
          </div>

          {/* Live Tracking Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <PlayIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Live Tracking Time</p>
                <p className="text-3xl font-bold text-gray-900">
                  {autoTracking ? `${elapsedMinutes}m ${elapsedSeconds % 60}s` : '0m 0s'}
                </p>
                {autoTracking && totalMinutes > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Target: {totalMinutes} minutes</p>
                  </div>
                )}
                {!autoTracking && (
                  <p className="text-xs text-gray-400">Start tracking to see live time</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Internship Card - Enhanced with Address and Today's Date */}
        {internship ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
            <div className={`bg-gradient-to-r px-6 py-4 ${internship.is_test_mode ? 'from-yellow-600 to-orange-600' : 'from-indigo-600 to-purple-600'}`}>
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Active Internship</h2>
                  <p className="text-indigo-100">{internship.company_name} - {internship.role_name}</p>
                  <p className="text-sm text-white mt-1">
                    🕐 Schedule: {internship.daily_start} - {internship.daily_end}
                  </p>
                </div>
                <div>
                  {!autoTracking ? (
                    <button
                      onClick={startAutoTracking}
                      disabled={submitting || !internship.can_start}
                      className={`inline-flex items-center px-4 py-2 rounded-lg disabled:opacity-50 ${
                        internship.can_start 
                          ? 'bg-green-500 text-white hover:bg-green-600' 
                          : 'bg-gray-400 text-white cursor-not-allowed'
                      }`}
                    >
                      <PlayIcon className="h-5 w-5 mr-2" />
                      Start Auto-Tracking
                    </button>
                  ) : (
                    <button
                      onClick={stopAutoTracking}
                      disabled={submitting}
                      className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      <StopIcon className="h-5 w-5 mr-2" />
                      Stop Tracking
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {/* Status Message */}
              {!internship.can_start && !autoTracking && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
                    <span className="text-yellow-800">{internship.status_message}</span>
                  </div>
                </div>
              )}

              {/* Company Details - Address and Today's Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-start gap-2">
                  <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Company Address</p>
                    <p className="text-gray-700">{internship.company_address || 'Address not available'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Today's Date</p>
                    <p className="text-gray-700">{today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Progress Section - Only during live tracking */}
              {autoTracking && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Session Progress</span>
                    <span className="text-sm font-medium text-indigo-600">
                      {elapsedMinutes} / {totalMinutes} min
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`rounded-full h-3 transition-all duration-500 ${progressPercent >= 100 ? 'bg-green-600' : 'bg-indigo-600'}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {remainingMinutes > 0 && (
                    <div className="mt-2 text-center">
                      <span className="text-sm text-orange-600 font-medium">
                        ⏱️ Session ends in: {remainingMinutes} minutes
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Location Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <MapPinIcon className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="font-medium text-gray-700">Verification Details</span>
                </div>
                <p className="text-sm text-gray-600">
                  Location verification is active. You must be within the company geofence.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Verification radius: {internship.radius} meters
                </p>
                {internship.is_test_mode && (
                  <p className="text-xs text-blue-600 mt-2">
                    ⚡ Auto-fetch every {internship.proof_interval_minutes} minute(s)
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8 text-center">
            <p className="text-yellow-800">No active internship assigned.</p>
          </div>
        )}

        {/* Split View: Today's Timeline + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Timeline - Left Side */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Timeline</h2>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {todayProofs.length > 0 ? (
                  todayProofs.map((proof, idx) => (
                    <div key={idx} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-sm font-mono font-bold text-gray-700 w-24">
                          {proof.time}
                        </div>
                        <div className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                          proof.verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {proof.type === 'hourly' ? 'Periodic Check' : proof.type}
                        </div>
                        {proof.verified ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm ${proof.verified ? 'text-green-600' : 'text-red-600'}`}>
                          {proof.verified 
                            ? `✓ Verified (${Math.round(proof.distance)}m)` 
                            : `✗ Failed (${Math.round(proof.distance)}m away)`}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <ClockIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                    <p>No proofs recorded today</p>
                    <p className="text-sm">Start tracking to record your attendance</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mini Calendar - Right Side */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-indigo-600" />
                Attendance Calendar
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => changeMonth(-1)}
                  className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                >
                  ◀
                </button>
                <span className="text-sm font-medium">
                  {new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => changeMonth(1)}
                  className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                >
                  ▶
                </button>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-4">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: getFirstDayOfMonth(selectedYear, selectedMonth) }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square p-1" />
                ))}
                {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const attendance = calendarData[dateStr]
                  const isToday = dateStr === todayStr
                  
                  let bgColor = 'bg-gray-50 hover:bg-gray-100'
                  
                  if (attendance) {
                    if (attendance.status === 'full_day' || attendance.status === 'partial') {
                      bgColor = 'bg-green-50 hover:bg-green-100'
                    } else if (attendance.status === 'absent') {
                      bgColor = 'bg-red-50 hover:bg-red-100'
                    }
                  }
                  
                  return (
                    <div
                      key={day}
                      className={`aspect-square p-1 rounded-lg ${bgColor} ${isToday ? 'ring-2 ring-indigo-500' : ''}`}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <span className={`text-sm font-medium ${
                          attendance && (attendance.status === 'full_day' || attendance.status === 'partial')
                            ? 'text-green-700'
                            : attendance?.status === 'absent'
                            ? 'text-red-700'
                            : 'text-gray-700'
                        }`}>
                          {day}
                        </span>
                        {attendance && attendance.hours > 0 && (
                          <span className="text-xs text-gray-500">{attendance.hours}h</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Legend */}
              <div className="mt-4 pt-3 border-t flex justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-200 rounded"></div>
                  <span>No Record</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard