// frontend-web/src/pages/Analytics.jsx
import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../api/client';
import StatsCard from '../components/StatsCard';

const SEVERITY_COLORS = {
  low:      '#94A3B8',
  medium:   '#F59E0B',
  high:     '#DC2626',
  critical: '#B91C1C',
  unknown:  '#CBD5E1',
};

const LAYER_COLORS = {
  chain: '#1E293B',
  wifi:  '#F59E0B',
  face:  '#16A34A',
  zkp:   '#4F46E5',
};

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const defaultFrom = iso(
  new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90)
);
const Analytics = () => {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(iso(today));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/v2/analytics/summary?from=${from}&to=${to}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const severityPie = data
    ? Object.entries(data.anomaly_count_by_severity || {}).map(([name, value]) => ({ name, value }))
    : [];

  const layerBars = data
    ? (data.layer_success_rates || []).map((r) => ({
        layer: r.layer,
        success: Math.round(r.success_rate * 100),
        failures: r.failures,
        attempts: r.attempts,
      }))
    : [];

  const attendancePct = data ? Math.round((data.attendance_rate || 0) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-500">
            Attendance, anomalies, and layer success rates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-sm"
          />
          <label className="text-sm text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {error && <div className="card bg-danger-500 text-white mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatsCard label="Total sessions" value={data.total_sessions} />
            <StatsCard label="Verified" value={data.verified_sessions} accent="success" />
            <StatsCard label="Flagged" value={data.flagged_sessions} accent="danger" />
            <StatsCard label="Attendance rate" value={`${attendancePct}%`} accent="primary" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="card-header">Anomalies by severity</h2>
              {severityPie.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 text-center">No anomalies in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={severityPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%" outerRadius={90}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {severityPie.map((entry) => (
                        <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#CBD5E1'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 className="card-header">Layer success rate</h2>
              {layerBars.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 text-center">No layer data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={layerBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="layer" />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip
                      formatter={(value, name, props) =>
                        [`${value}% (${props.payload.success} / ${props.payload.attempts})`, 'Success rate']
                      }
                    />
                    <Bar dataKey="success" radius={[6, 6, 0, 0]}>
                      {layerBars.map((entry) => (
                        <Cell key={entry.layer} fill={LAYER_COLORS[entry.layer] || '#94A3B8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card mt-6">
            <h2 className="card-header">Anomalies by type</h2>
            {Object.keys(data.anomaly_count_by_type || {}).length === 0 ? (
              <p className="text-slate-400 text-sm py-4">No anomalies in this range.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {Object.entries(data.anomaly_count_by_type).map(([type, count]) => (
                  <li key={type} className="flex justify-between py-2 text-sm">
                    <span className="text-slate-700">{type}</span>
                    <span className="font-medium text-slate-800">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;