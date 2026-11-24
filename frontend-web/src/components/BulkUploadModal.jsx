// frontend-web/src/components/BulkUploadModal.jsx
import React, { useState, useRef } from 'react';
import api from '../api/client';

const MAX_ROWS = 500;

const parseCsvPreview = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1, 11).map((line, i) => {
    // Naive CSV split — no quoted-comma handling for the preview
    // (backend does proper parsing)
    const cells = line.split(',');
    const obj = { _row: i + 2 };
    headers.forEach((h, idx) => { obj[h] = (cells[idx] || '').trim(); });
    return obj;
  });
  return { headers, rows, totalLines: lines.length - 1 };
};

const BulkUploadModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    setResult(null);

    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please choose a .csv file');
      return;
    }

    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result || '';
      const parsed = parseCsvPreview(text);
      const missing = ['student_id', 'name', 'email'].filter(
        (c) => !parsed.headers.includes(c)
      );
      setPreview({ ...parsed, missing });
    };
    reader.readAsText(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/v2/students/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.created > 0) onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadErrorCsv = () => {
    if (!result) return;
    const rows = result.results.filter((r) => r.status !== 'created');
    const header = ['row', 'status', 'student_id', 'reason'];
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.row,
          r.status,
          r.student_id || '',
          `"${(r.reason || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-upload-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Bulk Upload Students</h3>
            <p className="text-xs text-slate-500">
              Upload a CSV with columns: <code className="font-mono">student_id, name, email</code>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
            <p className="font-medium mb-1">CSV format:</p>
            <pre className="font-mono text-xs bg-white border border-slate-200 rounded p-2 overflow-x-auto">
{`student_id,name,email,company_id
S001,Alice Kumar,alice@example.com,1
S002,Bob Singh,bob@example.com,
S003,Carol Mehta,carol@example.com,`}
            </pre>
            <p className="text-xs mt-1">
              • <strong>Required:</strong> student_id, name, email<br />
              • <strong>Optional:</strong> company_id (leave blank if unsure)<br />
              • <strong>Ignored:</strong> password column (all students get "password123")<br />
              • Max {MAX_ROWS} rows per upload
            </p>
          </div>

          {/* File picker */}
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-500 file:text-white hover:file:bg-primary-600 file:cursor-pointer"
            />
          </div>

          {error && (
            <div className="bg-danger-500 text-white text-sm p-3 rounded-lg">{error}</div>
          )}

          {/* Preview */}
          {preview && !result && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs text-slate-600 border-b border-slate-200">
                <strong>{preview.totalLines}</strong> data row{preview.totalLines === 1 ? '' : 's'} detected
                {preview.missing.length > 0 && (
                  <span className="ml-2 text-danger-500 font-medium">
                    ⚠ Missing columns: {preview.missing.join(', ')}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left py-1 px-2 text-slate-500 font-medium">Row</th>
                      {preview.headers.map((h) => (
                        <th key={h} className="text-left py-1 px-2 text-slate-500 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r._row} className="border-b border-slate-100">
                        <td className="py-1 px-2 text-slate-400">{r._row}</td>
                        {preview.headers.map((h) => (
                          <td key={h} className="py-1 px-2 text-slate-700">
                            {r[h] || <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-sm border-b border-slate-200 flex justify-between items-center">
                <div>
                  <strong className="text-success-500">{result.created} created</strong>
                  <span className="mx-2 text-slate-300">·</span>
                  <strong className="text-warning-500">{result.skipped} skipped</strong>
                  <span className="mx-2 text-slate-300">·</span>
                  <strong className="text-danger-500">{result.errors} error{result.errors === 1 ? '' : 's'}</strong>
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="text-slate-500">{result.total} total</span>
                </div>
                {result.created + result.skipped + result.errors > result.created && (
                  <button
                    onClick={downloadErrorCsv}
                    className="text-primary-500 hover:underline text-xs"
                  >
                    Download failures CSV
                  </button>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left py-1 px-2 text-slate-500 font-medium">Row</th>
                      <th className="text-left py-1 px-2 text-slate-500 font-medium">Student</th>
                      <th className="text-left py-1 px-2 text-slate-500 font-medium">Status</th>
                      <th className="text-left py-1 px-2 text-slate-500 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.row} className="border-b border-slate-100">
                        <td className="py-1 px-2 text-slate-400">{r.row}</td>
                        <td className="py-1 px-2 text-slate-700 font-mono">
                          {r.student_id || '—'}
                        </td>
                        <td className="py-1 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            r.status === 'created' ? 'bg-success-500 text-white' :
                            r.status === 'skipped' ? 'bg-warning-500 text-white' :
                                                     'bg-danger-500 text-white'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-slate-500">
                          {r.reason || `id=${r.id}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={!file || uploading || (preview && preview.missing.length > 0)}
              className="btn-primary"
            >
              {uploading ? 'Uploading…' : 'Upload Students'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;