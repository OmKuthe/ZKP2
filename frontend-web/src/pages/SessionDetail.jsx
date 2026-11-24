// frontend-web/src/pages/SessionDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import EventTimeline from '../components/EventTimeline';
import { SeverityBadge, StatusBadge } from '../components/AnomalyBadge';

const Badge = ({ label, ok }) => {
  const cls =
    ok === true  ? 'bg-success-500 text-white' :
    ok === false ? 'bg-danger-500 text-white'  :
                   'bg-slate-200 text-slate-600';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}: {ok === true ? '✓' : ok === false ? '✗' : '—'}
    </span>
  );
};

const SessionDetail = () => {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`/v2/sessions/${id}`);
        setDetail(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="card text-center py-12">
        <p className="text-danger-500 mb-4">{error || 'Session not found'}</p>
        <Link to="/manager/flagged" className="btn-secondary">← Back to Flagged</Link>
      </div>
    );
  }

  const s = detail.session;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/manager/flagged" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{s.session_id}</h1>
          <p className="text-sm text-slate-500">
            {s.company_name} · {s.internship_name || 'No internship'}
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Status</p>
            <p className="font-medium mt-1">{s.status}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Duration</p>
            <p className="font-medium mt-1">{s.duration_minutes} min</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Started</p>
            <p className="font-medium mt-1">{new Date(s.started_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Ended</p>
            <p className="font-medium mt-1">
              {s.ended_at ? new Date(s.ended_at).toLocaleString() : 'Active'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Badge label="ZKP"   ok={s.zkp_verified} />
          <Badge label="Face"  ok={s.face_verified} />
          <Badge label="WiFi"  ok={s.wifi_verified} />
          <Badge label="Chain" ok={s.chain_verified} />
          <Badge label="Overall" ok={s.overall_verified} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="card-header">Anomalies ({detail.anomalies.length})</h2>
          {detail.anomalies.length === 0 ? (
            <p className="text-slate-400 text-sm py-2">No anomalies recorded.</p>
          ) : (
            <ul className="space-y-3">
              {detail.anomalies.map((a) => (
                <li key={a.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-800 text-sm">{a.type}</span>
                    <SeverityBadge severity={a.severity} />
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-slate-500 whitespace-pre-wrap">{a.description}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Detected: {a.detected_at ? new Date(a.detected_at).toLocaleString() : '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="card-header">Challenges ({detail.challenges.length})</h2>
          {detail.challenges.length === 0 ? (
            <p className="text-slate-400 text-sm py-2">No re-verify challenges issued.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.challenges.map((c) => (
                <li key={c.id} className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
                  <span className="font-medium text-slate-700">#{c.id}</span>
                  <span className={`text-xs font-medium ${
                    c.status === 'passed'  ? 'text-success-500' :
                    c.status === 'failed'  ? 'text-danger-500'  :
                    c.status === 'expired' ? 'text-danger-500'  :
                                              'text-warning-500'
                  }`}>{c.status}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.issued_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="card-header">Verification events ({detail.events.length})</h2>
        <EventTimeline events={detail.events} />
      </div>

      <div className="card mt-6">
        <h2 className="card-header">Heartbeats ({detail.heartbeats.length})</h2>
        {detail.heartbeats.length === 0 ? (
          <p className="text-slate-400 text-sm py-2">No heartbeats recorded.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 sticky top-0 bg-white">
                  <th className="text-left py-1 px-2 text-slate-500 text-xs font-medium">#</th>
                  <th className="text-left py-1 px-2 text-slate-500 text-xs font-medium">Valid</th>
                  <th className="text-left py-1 px-2 text-slate-500 text-xs font-medium">Client time</th>
                  <th className="text-left py-1 px-2 text-slate-500 text-xs font-medium">Server time</th>
                  <th className="text-left py-1 px-2 text-slate-500 text-xs font-medium">Backfilled</th>
                </tr>
              </thead>
              <tbody>
                {detail.heartbeats.map((h) => (
                  <tr key={h.id} className="border-b border-slate-100">
                    <td className="py-1 px-2 text-xs text-slate-500">{h.sequence_num}</td>
                    <td className="py-1 px-2">
                      <span className={`text-xs ${h.valid ? 'text-success-500' : 'text-danger-500'}`}>
                        {h.valid ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-xs text-slate-500">
                      {h.client_reported_at ? new Date(h.client_reported_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-1 px-2 text-xs text-slate-500">
                      {h.server_received_at ? new Date(h.server_received_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-1 px-2 text-xs text-slate-400">
                      {h.backfilled ? 'yes' : 'no'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDetail;