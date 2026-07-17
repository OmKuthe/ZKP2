import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

// ── Helper Functions ──────────────────────────────────────────────────────────

const getMonthDays = (year, month) => {
  return new Date(year, month + 1, 0).getDate()
}

const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month, 1).getDay()
}

const getISTDateStr = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')
}

// Month names
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Day names
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Status badge component
const StatusBadge = ({ status }) => {
  const map = {
    full_day:    { label: 'Full Day',    cls: 'bg-emerald-100 text-emerald-800', icon: '✅' },
    partial:     { label: 'Partial',     cls: 'bg-yellow-100 text-yellow-800',   icon: '🟡' },
    in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700',       icon: '🔄' },
    absent:      { label: 'Absent',      cls: 'bg-red-100 text-red-800',         icon: '❌' }
  }
  const { label, cls, icon } = map[status] ?? { label: 'No Record', cls: 'bg-gray-100 text-gray-600', icon: '⚪' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      <span>{icon}</span>
      {label}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const StudentCalendar = () => {
  const { studentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const internshipId = searchParams.get('internship')

  const [studentName, setStudentName] = useState('')
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    fetchCalendar()
  }, [currentYear, currentMonth])

  const fetchCalendar = async () => {
    setLoading(true)
    try {
      const response = await api.get(
        `/api/manager/student/${studentId}/calendar`,
        {
          params: {
            internship_id: internshipId,
            year: currentYear,
            month: currentMonth + 1
          }
        }
      )
      setAttendance(response.data.attendance || {})
      setStudentName(response.data.student_name || studentId)
    } catch (error) {
      console.error('Error fetching calendar:', error)
      toast.error('Failed to load attendance calendar')
    } finally {
      setLoading(false)
    }
  }

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
    setSelectedDate(null)
  }

  const handleDateClick = (dateStr) => {
    setSelectedDate(dateStr)
  }

  const getDayStatus = (dateStr) => {
    const dayData = attendance[dateStr]
    if (!dayData) return { status: 'no_record', hours: 0, proofCount: 0 }
    
    let status = 'no_record'
    if (dayData.status === 'full_day') status = 'full_day'
    else if (dayData.status === 'partial') status = 'partial'
    else if (dayData.status === 'in_progress') status = 'in_progress'
    else if (dayData.status === 'absent') status = 'absent'
    
    return {
      status,
      hours: dayData.hours,
      proofCount: dayData.proof_count
    }
  }

  const getDayColor = (dateStr) => {
    const dayData = attendance[dateStr]
    if (!dayData) return 'bg-gray-50 hover:bg-gray-100'
    
    switch (dayData.status) {
      case 'full_day':
        return 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300'
      case 'partial':
        return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300'
      case 'in_progress':
        return 'bg-blue-100 hover:bg-blue-200 border-blue-300'
      case 'absent':
        return 'bg-red-100 hover:bg-red-200 border-red-300'
      default:
        return 'bg-gray-50 hover:bg-gray-100'
    }
  }

  // Calculate statistics
  const calculateStats = () => {
    const days = Object.values(attendance)
    const totalDays = days.length
    const fullDays = days.filter(d => d.status === 'full_day').length
    const partialDays = days.filter(d => d.status === 'partial').length
    const presentDays = fullDays + partialDays
    const totalHours = days.reduce((sum, d) => sum + (d.hours || 0), 0)
    
    return {
      totalDays,
      fullDays,
      partialDays,
      presentDays,
      totalHours,
      attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0
    }
  }

  const stats = calculateStats()

  // Generate calendar grid
  const daysInMonth = getMonthDays(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const todayStr = getISTDateStr()

  const calendarDays = []
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ date: null, isEmpty: true })
  }
  // Actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = dateStr === todayStr
    const isSelected = dateStr === selectedDate
    const dayStatus = getDayStatus(dateStr)
    
    calendarDays.push({
      date: day,
      dateStr,
      isEmpty: false,
      isToday,
      isSelected,
      status: dayStatus.status,
      hours: dayStatus.hours,
      proofCount: dayStatus.proofCount
    })
  }

  const selectedDayData = selectedDate ? attendance[selectedDate] : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-5"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Student Timeline
        </button>

        {/* Student Header */}
        <div className="bg-white rounded-xl shadow mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
            <h2 className="text-2xl font-bold text-white">Attendance Calendar</h2>
            <p className="text-indigo-200 text-sm mt-1">
              Student: {studentName} ({studentId})
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Total Days</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Full Days</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.fullDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Partial Days</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.partialDays}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Attendance Rate</p>
            <p className={`text-2xl font-bold ${
              stats.attendanceRate >= 75 ? 'text-emerald-600' :
              stats.attendanceRate >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.attendanceRate}%
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.totalHours.toFixed(1)}</p>
          </div>
        </div>

        {/* Calendar and Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow overflow-hidden">
            {/* Calendar Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900">
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRightIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-1 px-4 pt-4">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 p-4">
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  onClick={() => !day.isEmpty && handleDateClick(day.dateStr)}
                  className={`
                    aspect-square p-1 rounded-lg cursor-pointer transition-all
                    ${day.isEmpty ? 'invisible' : ''}
                    ${day.isSelected ? 'ring-2 ring-indigo-500 shadow-md' : ''}
                    ${day.isToday && !day.isSelected ? 'ring-2 ring-indigo-300' : ''}
                    ${!day.isEmpty ? getDayColor(day.dateStr) : ''}
                  `}
                >
                  {!day.isEmpty && (
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className={`text-sm font-medium ${
                        day.status === 'full_day' ? 'text-emerald-700' :
                        day.status === 'partial' ? 'text-yellow-700' :
                        day.status === 'absent' ? 'text-red-700' :
                        day.status === 'in_progress' ? 'text-blue-700' :
                        'text-gray-700'
                      }`}>
                        {day.date}
                      </span>
                      {day.hours > 0 && (
                        <span className="text-[10px] text-gray-500 mt-0.5">
                          {day.hours}h
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="px-6 py-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></div>
                <span className="text-gray-600">Full Day Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
                <span className="text-gray-600">Partial Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div>
                <span className="text-gray-600">In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
                <span className="text-gray-600">Absent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></div>
                <span className="text-gray-600">No Record</span>
              </div>
            </div>
          </div>

          {/* Selected Date Details */}
          <div className="bg-white rounded-xl shadow">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-indigo-500" />
                Date Details
              </h3>
            </div>
            <div className="p-5">
              {selectedDate ? (
                <>
                  <div className="text-center mb-4">
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(selectedDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  {selectedDayData ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-gray-500">Status</span>
                        <StatusBadge status={selectedDayData.status} />
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          Total Hours
                        </span>
                        <span className="font-medium">{selectedDayData.hours} hrs</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                          Proofs
                        </span>
                        <span className="font-medium">{selectedDayData.proof_count} proofs</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <XCircleIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                      <p>No attendance record</p>
                      <p className="text-sm">No proofs submitted on this day</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <CalendarIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>Select a date</p>
                  <p className="text-sm">Click on any day to see details</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="mt-6 bg-white rounded-xl shadow p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
            Attendance Summary for {monthNames[currentMonth]} {currentYear}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Present Days</p>
              <p className="text-xl font-bold text-emerald-600">
                {stats.presentDays} / {stats.totalDays}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Full Day Present</p>
              <p className="text-xl font-bold text-emerald-600">{stats.fullDays}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Partial Present</p>
              <p className="text-xl font-bold text-yellow-600">{stats.partialDays}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-xl font-bold text-indigo-600">{stats.totalHours.toFixed(1)}</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Attendance Rate</span>
              <span>{stats.attendanceRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`rounded-full h-2 transition-all ${
                  stats.attendanceRate >= 75 ? 'bg-emerald-500' :
                  stats.attendanceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${stats.attendanceRate}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Target: 75% to be considered "At Risk" threshold
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentCalendar