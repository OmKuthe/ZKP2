// frontend-web/src/components/StudentDetailDrawer.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const Badge = ({ label, ok }) => {
  const cls =
    ok === true  ? 'bg-success-500 text-white' :
    ok === false ? 'bg-danger-500 text-white'  :
                   'bg-slate-200 text-slate-600';
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}: {ok === true ? '✓' : ok === false ? '✗' : '—'}
    </span>
  );
};

const statusLabel = (s) => {
  if (s === 'active')   return { text: 'Present', cls: 'bg-success-500 text-white' };
  if (s === 'flagged')  return { text: 'Flagged', cls: 'bg-danger-500 text-white' };
  if (s === 'closed')   return { text: 'Closed',  cls: 'bg-slate-200 text-slate-700' };
  return { text: s || '—', cls: 'bg-slate-100 text-slate-600' };
};

const StudentDetailDrawer = ({ student, internship, onClose }) => {
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!student) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [activeRes, sessionsRes] = await Promise.allSettled([
          api.get(`/student/active-session/${student.student_id}`),
          api.get(`/v2/students/${student.student_id}/sessions?limit=7`),
        ]);

        if (cancelled) return;

        if (activeRes.status === 'fulfilled') {
          setActiveSession(activeRes.value.data);
        }
        if (sessionsRes.status === 'fulfilled') {
          setSessions(sessionsRes.value.data.sessions || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || err.message || 'Failed to load student data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [student]);

  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!student) return null;

  const isPresent = activeSession?.active === true;
  const activeSince = isPresent && activeSession?.session?.entry_time
    ? new Date(activeSession.session.entry_time)
    : null;
  const activeMinutes = activeSince
    ? Math.floor((Date.now() - activeSince.getTime()) / 60000)
    : 0;

  // Today's stats from most recent session
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter(
    (s) => (s.started_at || '').slice(0, 10) === today
  );
  const todayPresent = todaySessions.length > 0;

  // This week's stats
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekSessions = sessions.filter(
    (s) => s.started_at && new Date(s.started_at) >= weekAgo
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
        role="dialog"
        aria-label={`Student detail for ${student.name}`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{student.name}</h2>
            <p className="text-xs text-slate-500 font-mono">{student.student_id}</p>
            <p className="text-xs text-slate-400">{student.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-danger-500 text-white text-sm p-2 rounded">{error}</div>
          )}

          {/* Live status */}
          <div className="card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Current status
            </p>
            {loading ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : isPresent ? (
              <>
                <p className="text-lg font-semibold text-success-500">Present</p>
                <p className="text-xs text-slate-500 mt-1">
                  Checked in {activeMinutes} min ago at{' '}
                  {activeSince?.toLocaleTimeString()}
                </p>
                <Link
                  to={`/manager/sessions/${activeSession.session.session_id}`}
                  className="text-primary-500 hover:underline text-xs mt-2 inline-block"
                >
                  View active session →
                </Link>
              </>
            ) : (
              <p className="text-lg font-semibold text-slate-500">Not present</p>
            )}
          </div>

          {/* Today */}
          <div className="card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Today</p>
            {todayPresent ? (
              <ul className="space-y-1 text-sm">
                {todaySessions.map((s) => (
                  <li key={s.id} className="flex justify-between items-center">
                    <span className="text-slate-700">
                      {new Date(s.started_at).toLocaleTimeString()} →{' '}
                      {s.ended_at ? new Date(s.ended_at).toLocaleTimeString() : '…'}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusLabel(s.status).cls}`}>
                      {statusLabel(s.status).text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No check-in today.</p>
            )}
          </div>

          {/* This week */}
          <div className="card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">This week</p>
            <div className="flex justify-between text-sm">
              <div>
                <p className="text-2xl font-bold text-slate-800">{weekSessions.length}</p>
                <p className="text-xs text-slate-500">sessions</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success-500">
                  {weekSessions.filter((s) => s.overall_verified).length}
                </p>
                <p className="text-xs text-slate-500">fully verified</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-danger-500">
                  {weekSessions.filter((s) => s.status === 'flagged').length}
                </p>
                <p className="text-xs text-slate-500">flagged</p>
              </div>
            </div>
          </div>

          {/* Last 7 sessions */}
          <div className="card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              Recent sessions
            </p>
            {loading ? (
              <p className="text-slate-400 text-sm">Loading…</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-slate-400">No sessions recorded.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="border-b border-slate-100 pb-2 last:border-0">
                    <div className="flex justify-between items-center">
                      <Link
                        to={`/manager/sessions/${s.session_id}`}
                        className="text-sm font-medium text-primary-500 hover:underline"
                      >
                        {new Date(s.started_at).toLocaleDateString()}
                      </Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${statusLabel(s.status).cls}`}>
                        {statusLabel(s.status).text}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(s.started_at).toLocaleTimeString()} ·{' '}
                      {s.duration_minutes} min
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge label="ZKP"   ok={s.zkp_verified} />
                      <Badge label="Face"  ok={s.face_verified} />
                      <Badge label="WiFi"  ok={s.wifi_verified} />
                      <Badge label="Chain" ok={s.chain_verified} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default StudentDetailDrawer;