// frontend-web/src/components/EventTimeline.jsx
import React from 'react';

const layerColor = {
  zkp:   'bg-primary-500',
  face:  'bg-success-500',
  wifi:  'bg-warning-500',
  chain: 'bg-slate-700',
};

const eventLabel = {
  attempt:          'Attempt',
  success:          'Success',
  failure:          'Failure',
  challenge_sent:   'Challenge sent',
  challenge_passed: 'Challenge passed',
  challenge_failed: 'Challenge failed',
};

const EventTimeline = ({ events = [] }) => {
  if (events.length === 0) {
    return <p className="text-slate-400 text-sm py-4">No verification events recorded.</p>;
  }
  return (
    <ol className="relative border-l border-slate-200 ml-3">
      {events.map((e) => (
        <li key={e.id} className="mb-4 ml-6">
          <span className={`absolute -left-2 w-4 h-4 rounded-full ${layerColor[e.layer] || 'bg-slate-400'}`} />
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-slate-800">{eventLabel[e.event_type] || e.event_type}</span>
            <span className="text-xs uppercase tracking-wide text-slate-500">{e.layer}</span>
            <span className="text-xs text-slate-400 ml-auto">
              {new Date(e.occurred_at).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            source: {e.source_table}#{e.source_id}
          </p>
        </li>
      ))}
    </ol>
  );
};

export default EventTimeline;