// frontend-web/src/components/StatsCard.jsx
import React from 'react';

const StatsCard = ({ label, value, hint, accent = 'slate' }) => {
  const accentMap = {
    slate:   'text-slate-800',
    primary: 'text-primary-500',
    success: 'text-success-500',
    warning: 'text-warning-500',
    danger:  'text-danger-500',
  };
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accentMap[accent] || accentMap.slate}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
};

export default StatsCard;