// frontend-web/src/components/AnomalyBadge.jsx
import React from 'react';

const severityStyles = {
  low:      'bg-slate-100 text-slate-700',
  LOW:      'bg-slate-100 text-slate-700',
  medium:   'bg-warning-500 text-white',
  MEDIUM:   'bg-warning-500 text-white',
  high:     'bg-danger-500 text-white',
  HIGH:     'bg-danger-500 text-white',
  critical: 'bg-danger-600 text-white',
  CRITICAL: 'bg-danger-600 text-white',
};

const statusStyles = {
  open:      'bg-danger-500 text-white',
  reviewed:  'bg-warning-500 text-white',
  dismissed: 'bg-slate-300 text-slate-700',
  resolved:  'bg-success-500 text-white',
};

export const SeverityBadge = ({ severity }) => {
  const cls = severityStyles[severity] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {severity || '—'}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const cls = statusStyles[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || '—'}
    </span>
  );
};