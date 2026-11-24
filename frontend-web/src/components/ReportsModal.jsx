// frontend-web/src/components/ReportsModal.jsx
import React, { useEffect, useState } from 'react';
import api from '../api/client';
import useCsvDownload from '../hooks/useCSVDownload';

const ReportsModal = ({ internship, students = [], onClose }) => {
  const { download, loading, error } = useCsvDownload();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Default the date range to the internship's start/end
  useEffect(() => {
    if (internship) {
      try {
        setFromDate(new Date(internship.start_date).toISOString().slice(0, 10));
        setToDate(new Date(internship.end_date).toISOString().slice(0, 10));
      } catch {
        // ignore parse errors
      }
    }
  }, [internship]);

  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].student_id);
    }
  }, [students, selectedStudentId]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (fromDate) params.append('from', fromDate);
    if (toDate) params.append('to', toDate);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const handleDownloadInternship = async () => {
    const url = `/v2/reports/internship/${internship.id}/attendance.csv${buildQuery()}`;
    await download(
      url,
      `internship_${internship.id}_${fromDate || 'start'}_${toDate || 'end'}.csv`
    );
  };

  const handleDownloadStudent = async () => {
    if (!selectedStudentId) return;
    const url = `/v2/reports/student/${selectedStudentId}/sessions.csv${buildQuery()}`;
    await download(
      url,
      `student_${selectedStudentId}_${fromDate || 'start'}_${toDate || 'end'}.csv`
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="border-b border-slate-200 p-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Download Reports</h3>
            <p className="text-xs text-slate-500">
              {internship?.name} · {students.length} student{students.length === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Date range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date range</label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Leave blank to include all sessions.
            </p>
          </div>

          {error && (
            <div className="bg-danger-500 text-white text-sm p-2 rounded">{error}</div>
          )}

          {/* Internship-wide */}
          <div className="border border-slate-200 rounded-lg p-3">
            <h4 className="font-medium text-slate-800 text-sm mb-1">Internship-wide attendance</h4>
            <p className="text-xs text-slate-500 mb-3">
              All sessions for all {students.length} students in this internship. One row per session.
            </p>
            <button
              onClick={handleDownloadInternship}
              disabled={loading}
              className="btn-primary text-sm"
            >
              {loading ? 'Downloading…' : '📥 Download internship CSV'}
            </button>
          </div>

          {/* Per-student */}
          <div className="border border-slate-200 rounded-lg p-3">
            <h4 className="font-medium text-slate-800 text-sm mb-1">Per-student sessions</h4>
            <p className="text-xs text-slate-500 mb-3">
              Sessions for a single student in this date range.
            </p>
            <div className="flex gap-2 items-center">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                disabled={students.length === 0}
              >
                {students.length === 0 ? (
                  <option value="">No students in this internship</option>
                ) : (
                  students.map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.name} ({s.student_id})
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={handleDownloadStudent}
                disabled={loading || !selectedStudentId}
                className="btn-secondary text-sm"
              >
                📥 Download
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ReportsModal;