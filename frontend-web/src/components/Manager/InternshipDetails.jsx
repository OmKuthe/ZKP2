import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { 
  ArrowLeftIcon, 
  UsersIcon, 
  ClockIcon, 
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  TableCellsIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell
} from 'recharts'
import api from '../../services/api'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
const getISTDateStr = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')
}

// Parse an ISO string that already has +05:30 offset
const formatISTTime = (isoStr) => {
  if (!isoStr) return null
  try {
    return new Date(isoStr).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    })
  } catch {
    return isoStr
  }
}

// ── Status badge ── FIXED: Added 'present' mapping ────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    full_day:    { label: 'Full Day',    cls: 'bg-emerald-100 text-emerald-800' },
    partial:     { label: 'Partial',     cls: 'bg-yellow-100 text-yellow-800'   },
    in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700'       }, 
    present:     { label: 'Present',     cls: 'bg-emerald-100 text-emerald-800' },
    absent:      { label: 'Absent',      cls: 'bg-red-100 text-red-800'         },
  }
  const { label, cls } = map[status] ?? { label: status || 'Unknown', cls: 'bg-gray-100 text-gray-700' }
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${cls}`}>{label}</span>
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
const StatsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1 truncate max-w-[160px]">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.stroke }}>
          {p.name}: {p.value}{p.name.includes('%') || p.name.includes('Rate') ? '%' : ''}
        </p>
      ))}
    </div>
  )
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
const AttendanceHeatmap = ({ trend, totalStudents }) => {
  if (!trend || trend.length === 0) return <p className="text-sm text-gray-400">No data</p>

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {trend.map(d => {
          const rate = d.rate
          let bg = 'bg-gray-100'
          if (rate >= 90)      bg = 'bg-emerald-600'
          else if (rate >= 75) bg = 'bg-emerald-400'
          else if (rate >= 50) bg = 'bg-yellow-400'
          else if (rate >  0)  bg = 'bg-red-400'

          return (
            <div
              key={d.date}
              className={`w-8 h-8 rounded ${bg} flex items-center justify-center cursor-default`}
              title={`${d.date}: ${d.present} present (${rate}%)`}
            >
              <span className="text-[9px] text-white font-bold">
                {new Date(d.date + 'T00:00:00').getDate()}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span>Less</span>
        {['bg-gray-100','bg-red-400','bg-yellow-400','bg-emerald-400','bg-emerald-600'].map(c => (
          <span key={c} className={`w-4 h-4 rounded ${c} inline-block`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const InternshipDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [internship, setInternship]     = useState(null)
  const [students, setStudents]         = useState([])
  const [analytics, setAnalytics]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [activeTab, setActiveTab]       = useState('students')
  const [searchTerm, setSearchTerm]     = useState('')
  const [filter, setFilter]             = useState('all')

  useEffect(() => {
    fetchDetails()
    const interval = setInterval(fetchDetails, 30000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      fetchAnalytics()
    }
  }, [activeTab])

  const fetchDetails = async () => {
    try {
      const response = await api.get(`/api/manager/internship/${id}`)
      setInternship(response.data.internship)
      setStudents(response.data.students)
    } catch (error) {
      console.error('Error fetching details:', error)
      toast.error('Failed to load internship details')
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true)
    try {
      const response = await api.get(`/api/manager/internship/${id}/analytics?days=30`)
      setAnalytics(response.data)
    } catch (error) {
      console.error('Analytics error:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const exportReport = async () => {
    try {
      const today = getISTDateStr()
      const response = await api.get(`/api/manager/internship/${id}/export`, {
        params: { start_date: today, end_date: today }
      })
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `internship_${id}_report_${today}.json`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Report exported')
    } catch {
      toast.error('Failed to export report')
    }
  }

  // ── Filtering ── FIXED: Include 'present' status ─────────────────────────────
  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.roll_number || '').toLowerCase().includes(searchTerm.toLowerCase())

    // Updated to include 'present' as a present status
    const presentStatuses = ['full_day', 'partial', 'in_progress', 'present']
    const matchesFilter =
      filter === 'all' ||
      (filter === 'present' && presentStatuses.includes(student.today_status)) ||
      (filter === 'absent'  && student.today_status === 'absent')

    return matchesSearch && matchesFilter
  })

  // FIXED: Count present students correctly
  const presentStatuses = ['full_day', 'partial', 'in_progress', 'present']
  const presentCount = filteredStudents.filter(s => presentStatuses.includes(s.today_status)).length
  const absentCount  = filteredStudents.filter(s => s.today_status === 'absent').length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!internship) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <p className="text-red-800">Internship not found</p>
            <button onClick={() => navigate('/manager')} className="mt-4 text-indigo-600">Go Back</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <button onClick={() => navigate('/manager')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>

        {/* ── Internship header card ── FIXED: Show address instead of coordinates ── */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{internship.company_name}</h2>
              <p className="text-gray-600 mt-1">{internship.role_name}</p>
              {internship.description && (
                <p className="text-gray-400 text-sm mt-1">{internship.description}</p>
              )}
            </div>
            <button
              onClick={exportReport}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 text-sm"
            >
              <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
              Export Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Working Hours</p>
                <p className="font-medium text-sm">{internship.daily_start_time} – {internship.daily_end_time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Company Address</p>
                <p className="font-medium text-sm">
                  {internship.company_address || 'Address not available'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Today's Attendance</p>
                <p className="font-medium text-sm">
                  <span className="text-emerald-600">{presentCount} Present</span>
                  {' / '}
                  <span className="text-rose-500">{absentCount} Absent</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('students')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'students'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <TableCellsIcon className="h-4 w-4" />
            Students
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <ChartBarIcon className="h-4 w-4" />
            Analytics
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/*  STUDENTS TAB                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex flex-wrap gap-3 justify-between items-center">
                <h3 className="text-base font-semibold text-gray-900">
                  Students ({filteredStudents.length})
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Students</option>
                    <option value="present">Present Only</option>
                    <option value="absent">Absent Only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Student', 'ID / Roll', "Today's Hours", 'Status', 'Proofs', 'Last Proof (IST)', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredStudents.map(student => {
                    const analyticsStudent = analytics?.student_stats?.find(s => s.student_id === student.student_id)
                    const isAtRisk = analyticsStudent?.is_at_risk

                    return (
                      <tr key={student.student_id} className="hover:bg-gray-50">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{student.student_name}</span>
                            {isAtRisk && (
                              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" title="At risk: below 75% attendance" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{student.student_id}</div>
                          <div className="text-xs text-gray-400">Roll: {student.roll_number}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{student.today_hours} hrs</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge status={student.today_status} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {student.proof_count > 0 ? (
                            <div className="text-sm">
                              <span className="text-emerald-600 font-medium">{student.verified_count}</span>
                              <span className="text-gray-400">/{student.proof_count}</span>
                              <span className="ml-1 text-xs text-gray-400">verified</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No proofs</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {student.last_proof_time ? (
                            <span className="text-sm text-gray-600">{formatISTTime(student.last_proof_time)}</span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/manager/student/${student.student_id}/timeline?internship=${id}`)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View timeline"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filteredStudents.length === 0 && (
                <div className="p-10 text-center text-gray-400 text-sm">No students found</div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/*  ANALYTICS TAB (unchanged)                                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div>
            {loadingAnalytics ? (
              <div className="bg-white rounded-xl shadow p-16 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* Top KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Overall Rate (30d)',  value: `${analytics.overall_attendance_rate}%`, color: 'indigo' },
                    { label: 'Total Students',      value: analytics.total_students,                color: 'blue'   },
                    { label: 'At-Risk Students',    value: analytics.at_risk_count,                 color: 'amber'  },
                    { label: 'Period',              value: `${analytics.period_days} days`,         color: 'gray'   }
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-xl shadow p-4">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Attendance Heatmap */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">30-Day Attendance Heatmap</h3>
                  <AttendanceHeatmap trend={analytics.daily_trend} totalStudents={analytics.total_students} />
                </div>

                {/* Daily trend line */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Daily Attendance Trend</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={analytics.daily_trend.map(d => ({
                        ...d,
                        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                      }))}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<StatsTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={false} name="Present" />
                      <Line type="monotone" dataKey="absent"  stroke="#f43f5e" strokeWidth={2} dot={false} name="Absent"  />
                      <Line type="monotone" dataKey="rate"    stroke="#6366f1" strokeWidth={2} dot={false} name="Rate %"  strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Per-student bar chart */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Per-Student Attendance & Proof Success Rate</h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, analytics.student_stats.length * 36)}>
                    <BarChart
                      layout="vertical"
                      data={analytics.student_stats.map(s => ({
                        name: s.student_name.split(' ')[0],
                        'Attendance %': s.attendance_pct,
                        'Proof Success %': s.proof_success_rate,
                        atRisk: s.is_at_risk
                      }))}
                      margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip content={<StatsTooltip />} />
                      <Legend />
                      <Bar dataKey="Attendance %" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={10}>
                        {analytics.student_stats.map((s, idx) => (
                          <Cell key={idx} fill={s.is_at_risk ? '#f59e0b' : '#6366f1'} />
                        ))}
                      </Bar>
                      <Bar dataKey="Proof Success %" fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-amber-600 mt-2">⚠ Amber bars = at-risk (below 75% attendance)</p>
                </div>

                {/* Proof hour distribution */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Proof Submission by Hour (IST)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analytics.hourly_distribution} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} name="Proofs" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* At-risk students list */}
                {analytics.at_risk_students.length > 0 && (
                  <div className="bg-white rounded-xl shadow p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                      <h3 className="text-base font-semibold text-gray-800">
                        At-Risk Students
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                          Below 75% attendance
                        </span>
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {analytics.at_risk_students.map(s => (
                        <div
                          key={s.student_id}
                          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
                          onClick={() => navigate(`/manager/student/${s.student_id}/timeline?internship=${id}`)}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{s.name}</p>
                            <p className="text-xs text-gray-500">{s.student_id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-amber-700">{s.attendance_pct}%</p>
                            <p className="text-xs text-gray-400">attendance</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
                No analytics data available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default InternshipDetails