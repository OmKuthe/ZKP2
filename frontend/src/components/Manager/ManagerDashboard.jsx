import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  AcademicCapIcon, 
  BuildingOfficeIcon, 
  UsersIcon,
  CalendarIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import api from '../../services/api'
import toast from 'react-hot-toast'

// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = {
  present: '#10b981',
  absent:  '#f43f5e',
  primary: '#6366f1',
  warn:    '#f59e0b'
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const getISTDateStr = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')
}

// Custom tooltip for the trend line chart
const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-emerald-600">Present: {payload[0]?.value}</p>
      <p className="text-rose-500">Absent: {payload[1]?.value}</p>
      <p className="text-indigo-600">Rate: {payload[2]?.value}%</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
const ManagerDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [internships, setInternships]     = useState([])
  const [analytics, setAnalytics]         = useState(null)   // aggregated EDA
  const [loadingMain, setLoadingMain]     = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  useEffect(() => {
    fetchInternships()
    const interval = setInterval(fetchInternships, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchInternships = async () => {
    try {
      const response = await api.get('/api/manager/dashboard')
      setInternships(response.data.internships)
    } catch (error) {
      console.error('Error fetching internships:', error)
      toast.error('Failed to load dashboard')
    } finally {
      setLoadingMain(false)
    }
  }

  // Fetch analytics for ALL internships and merge them
  const fetchAnalytics = async () => {
    if (internships.length === 0) return
    setLoadingAnalytics(true)
    try {
      const results = await Promise.all(
        internships
          .filter(i => i.status === 'active')
          .map(i => api.get(`/api/manager/internship/${i.internship_id}/analytics?days=7`))
      )

      if (results.length === 0) {
        setAnalytics(null)
        return
      }

      // Merge daily trend across internships by date
      const trendMap = {}
      let totalAtRisk = 0
      const allAtRisk = []

      results.forEach(r => {
        const data = r.data
        totalAtRisk += data.at_risk_count
        allAtRisk.push(...data.at_risk_students)

        data.daily_trend.forEach(d => {
          if (!trendMap[d.date]) trendMap[d.date] = { date: d.date, present: 0, absent: 0, total: 0 }
          trendMap[d.date].present += d.present
          trendMap[d.date].absent  += d.absent
          trendMap[d.date].total   += (d.present + d.absent)
        })
      })

      const mergedTrend = Object.values(trendMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          ...d,
          // Short date label e.g. "May 7"
          label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
        }))

      setAnalytics({
        trend: mergedTrend,
        atRiskCount: totalAtRisk,
        atRiskStudents: allAtRisk,
        todayPresent: internships.reduce((s, i) => s + (i.present_today || 0), 0),
        todayAbsent:  internships.reduce((s, i) => s + (i.absent_today  || 0), 0)
      })
    } catch (err) {
      console.error('Analytics fetch error:', err)
      toast.error('Failed to load analytics')
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const toggleAnalytics = () => {
    if (!showAnalytics && !analytics) fetchAnalytics()
    setShowAnalytics(v => !v)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':    return 'bg-emerald-100 text-emerald-800'
      case 'upcoming':  return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      default:          return 'bg-gray-100 text-gray-800'
    }
  }

  // ── Derived totals ───────────────────────────────────────────────────────────
  const totalStudents  = internships.reduce((s, i) => s + i.total_students, 0)
  const totalPresent   = internships.reduce((s, i) => s + (i.present_today || 0), 0)
  const totalAbsent    = internships.reduce((s, i) => s + (i.absent_today  || 0), 0)
  const activeCount    = internships.filter(i => i.status === 'active').length
  const donutData      = [
    { name: 'Present', value: totalPresent },
    { name: 'Absent',  value: totalAbsent  }
  ]

  if (loadingMain) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Navbar ── */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <AcademicCapIcon className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">ZKAttend</span>
              <span className="ml-2 text-sm text-gray-500">Manager Portal</span>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={fetchInternships} className="p-2 text-gray-400 hover:text-gray-600" title="Refresh">
                <ArrowPathIcon className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-700">Welcome, {user.fullName}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Internships', value: internships.length,   icon: BuildingOfficeIcon, color: 'indigo' },
            { label: 'Total Students',    value: totalStudents,         icon: UsersIcon,          color: 'green'  },
            { label: 'Present Today',     value: totalPresent,          icon: CheckCircleIcon,    color: 'emerald'},
            { label: 'Active Internships',value: activeCount,           icon: CalendarIcon,       color: 'purple' }
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center">
                <div className={`p-3 bg-${color}-100 rounded-full`}>
                  <Icon className={`h-6 w-6 text-${color}-600`} />
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Analytics Toggle ── */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Your Internships</h2>
          {activeCount > 0 && (
            <button
              onClick={toggleAnalytics}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <ChartBarIcon className="h-4 w-4" />
              {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
            </button>
          )}
        </div>

        {/* ── EDA Analytics Panel ── */}
        {showAnalytics && (
          <div className="mb-8">
            {loadingAnalytics ? (
              <div className="bg-white rounded-xl shadow p-12 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Today's snapshot donut */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Today's Snapshot</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        <Cell fill={COLORS.present} />
                        <Cell fill={COLORS.absent}  />
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-around text-sm">
                    <span className="text-emerald-600 font-semibold">{analytics.todayPresent} Present</span>
                    <span className="text-rose-500 font-semibold">{analytics.todayAbsent} Absent</span>
                  </div>
                </div>

                {/* 7-day trend */}
                <div className="bg-white rounded-xl shadow p-6 lg:col-span-2">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">7-Day Attendance Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analytics.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<TrendTooltip />} />
                      <Line type="monotone" dataKey="present" stroke={COLORS.present} strokeWidth={2} dot={false} name="Present" />
                      <Line type="monotone" dataKey="absent"  stroke={COLORS.absent}  strokeWidth={2} dot={false} name="Absent"  />
                      <Line type="monotone" dataKey="rate"    stroke={COLORS.primary} strokeWidth={2} dot={false} name="Rate %"  strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* At-risk panel */}
                <div className="bg-white rounded-xl shadow p-6 lg:col-span-3">
                  <div className="flex items-center gap-2 mb-4">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                    <h3 className="text-base font-semibold text-gray-800">
                      At-Risk Students
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                        {analytics.atRiskCount} below 75%
                      </span>
                    </h3>
                  </div>
                  {analytics.atRiskStudents.length === 0 ? (
                    <p className="text-sm text-gray-500">No at-risk students. Great job! 🎉</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {analytics.atRiskStudents.map(s => (
                        <div key={s.student_id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{s.name}</p>
                            <p className="text-xs text-gray-500">{s.student_id}</p>
                          </div>
                          <span className="text-sm font-bold text-amber-700">{s.attendance_pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
                No analytics data available
              </div>
            )}
          </div>
        )}

        {/* ── Internship cards ── */}
        {internships.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            No internships assigned yet
          </div>
        ) : (
          <div className="grid gap-5">
            {internships.map((internship) => {
              const rate = internship.total_students > 0
                ? Math.round((internship.present_today / internship.total_students) * 100)
                : 0
              return (
                <div key={internship.internship_id} className="bg-white rounded-xl shadow hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">{internship.company_name}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(internship.status)}`}>
                            {internship.status}
                          </span>
                        </div>
                        <p className="text-gray-500 text-sm">{internship.role_name}</p>
                      </div>
                      <button
                        onClick={() => navigate(`/manager/internship/${internship.internship_id}`)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        <EyeIcon className="h-4 w-4 mr-2" />
                        View Details
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-gray-500">Working Hours</p>
                        <p className="font-medium">{internship.daily_hours}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Students</p>
                        <p className="font-medium">{internship.total_students}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Today's Attendance</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-medium text-emerald-600">{internship.present_today} present</span>
                          <span className="text-gray-300">|</span>
                          <span className="font-medium text-rose-500">{internship.absent_today} absent</span>
                        </div>
                      </div>
                    </div>

                    {/* Attendance rate bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Attendance Rate</span>
                        <span className="font-medium">{rate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`rounded-full h-2 transition-all ${rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ManagerDashboard