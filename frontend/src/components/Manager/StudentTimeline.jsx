import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeftIcon, MapPinIcon, ClockIcon, 
  CheckCircleIcon, XCircleIcon, ChartBarIcon ,CalendarIcon
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

// FIX: Use local date getters instead of toISOString() which gives UTC date.
// In IST, toISOString() would give the wrong date after 18:30 UTC (= midnight IST).
const getISTDateStr = () => {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')
}

const proofTypeConfig = {
  entry: {
    label: 'Entry',
    icon: (ok) => <CheckCircleIcon className="h-6 w-6 text-emerald-500" />,
    ring: 'border-emerald-400'
  },
  exit: {
    label: 'Exit',
    icon: (ok) => <CheckCircleIcon className="h-6 w-6 text-rose-400" />,
    ring: 'border-rose-400'
  },
  hourly: {
    label: 'Periodic Check',
    icon: (ok) => <ClockIcon className="h-6 w-6 text-indigo-400" />,
    ring: 'border-indigo-400'
  }
}

const StatusPill = ({ status }) => {
  const map = {
    full_day:    { label: 'Full Day',    cls: 'bg-emerald-100 text-emerald-800' },
    partial:     { label: 'Partial',     cls: 'bg-yellow-100  text-yellow-800'  },
    in_progress: { label: 'In Progress', cls: 'bg-blue-100    text-blue-700'    },
    absent:      { label: 'Absent',      cls: 'bg-red-100     text-red-800'     }
  }
  const { label, cls } = map[status] ?? { label: status ?? 'Unknown', cls: 'bg-gray-100 text-gray-700' }
  return <span className={`px-3 py-1 text-sm font-medium rounded-full ${cls}`}>{label}</span>
}

// ── Component ─────────────────────────────────────────────────────────────────
const StudentTimeline = () => {
  const { studentId }      = useParams()
  const [searchParams]     = useSearchParams()
  const navigate           = useNavigate()
  const internshipId       = searchParams.get('internship')

  // FIX: initialise with IST date string, not UTC toISOString()
  const [selectedDate, setSelectedDate] = useState(getISTDateStr())
  const [timeline, setTimeline]         = useState(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    fetchTimeline()
  }, [selectedDate])

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/manager/student/${studentId}/timeline`, {
        params: { internship_id: internshipId, date_param: selectedDate }
      })
      setTimeline(response.data)
    } catch (error) {
      console.error('Error fetching timeline:', error)
      toast.error('Failed to load student timeline')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const proofs     = timeline?.proofs ?? []
  const verified   = proofs.filter(p => p.verified).length
  const successRate = proofs.length > 0 ? Math.round((verified / proofs.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-5">
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back
        </button>

        {/* ── Header card ── */}
        <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
            <h2 className="text-2xl font-bold text-white">Student Timeline</h2>
            <p className="text-indigo-200 text-sm mt-1">ID: {studentId}</p>
          </div>

          <div className="px-6 py-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Date (IST)</label>
            <input
              type="date"
              value={selectedDate}
              // Don't allow future dates
              max={getISTDateStr()}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Total Hours',
              value: `${timeline?.total_hours ?? 0} hrs`,
              color: 'indigo'
            },
            {
              label: 'Status',
              value: <StatusPill status={timeline?.status} />,
              color: 'gray',
              raw: true
            },
            {
              label: 'Total Proofs',
              value: timeline?.proof_count ?? 0,
              color: 'blue'
            },
            {
              label: 'Proof Success Rate',
              value: `${successRate}%`,
              color: successRate >= 80 ? 'emerald' : successRate >= 50 ? 'amber' : 'rose'
            }
          ].map(({ label, value, color, raw }) => (
            <div key={label} className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              {raw ? value : (
                <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
              )}
            </div>
          ))}
        </div>
          <button
  onClick={() => navigate(`/manager/student/${studentId}/calendar?internship=${internshipId}`)}
  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
>
  <CalendarIcon className="h-4 w-4" />
  View Monthly Calendar
</button>
        {/* ── Proof breakdown ── */}
        {proofs.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <ChartBarIcon className="h-4 w-4 text-indigo-500" />
              Verification Breakdown
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${successRate}%` }}
                />
              </div>
              <div className="text-sm font-medium text-gray-600 whitespace-nowrap">
                <span className="text-emerald-600">{verified} verified</span>
                {' / '}
                <span className="text-gray-400">{proofs.length} total</span>
              </div>
            </div>
            {/* Proof type breakdown */}
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              {['entry', 'exit', 'hourly'].map(type => {
                const count = proofs.filter(p => p.type === type).length
                return count > 0 ? (
                  <span key={type} className="capitalize">
                    {type === 'hourly' ? 'Periodic' : type}: <strong>{count}</strong>
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">
              Proof Timeline
              <span className="ml-2 text-sm font-normal text-gray-400">(times in IST)</span>
            </h3>
          </div>

          <div className="p-6">
            {proofs.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <ClockIcon className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                <p className="text-sm">No proofs recorded for {selectedDate}</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

                <div className="space-y-5">
                  {proofs.map((proof, idx) => {
                    const cfg = proofTypeConfig[proof.type] ?? proofTypeConfig.hourly
                    return (
                      <div key={idx} className="relative flex items-start">
                        {/* Circle icon */}
                        <div className={`z-10 flex items-center justify-center w-12 h-12 rounded-full bg-white border-2 ${cfg.ring} flex-shrink-0`}>
                          {proof.verified
                            ? cfg.icon(true)
                            : <XCircleIcon className="h-6 w-6 text-gray-400" />
                          }
                        </div>

                        {/* Card */}
                        <div className="ml-4 flex-1">
                          <div className={`rounded-xl border p-4 ${proof.verified ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-gray-900 text-sm">{proof.time}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                  proof.type === 'entry'  ? 'bg-emerald-100 text-emerald-700' :
                                  proof.type === 'exit'   ? 'bg-rose-100 text-rose-700' :
                                  'bg-indigo-100 text-indigo-700'
                                }`}>
                                  {cfg.label}
                                </span>
                                {proof.verified
                                  ? <span className="text-xs text-emerald-600 font-medium">✓ Verified</span>
                                  : <span className="text-xs text-red-500 font-medium">✗ Failed</span>
                                }
                              </div>
                              {proof.distance != null && (
                                <span className="text-xs text-gray-400">
                                  {Math.round(proof.distance)}m from site
                                </span>
                              )}
                            </div>

                            <div className="flex items-center text-xs text-gray-500 gap-1">
                              <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" />
                              {proof.latitude?.toFixed(6)}, {proof.longitude?.toFixed(6)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentTimeline