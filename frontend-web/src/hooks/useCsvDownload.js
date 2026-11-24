// frontend-web/src/hooks/useCsvDownload.js
import { useState } from 'react';
import api from '../api/client';
/**
 * useCsvDownload
 * Returns { download, loading, error }
 *
 *   download('/v2/reports/student/S001/sessions.csv', 'sessions.csv')
 *
 * If `filename` is omitted, falls back to the Content-Disposition header's
 * filename, or "report.csv".
 */
const useCsvDownload = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const download = async (url, filename) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(url, { responseType: 'blob' });

      // Prefer caller-provided filename; fall back to Content-Disposition
      let name = filename;
      if (!name) {
        const cd = res.headers['content-disposition'] || '';
        const match = cd.match(/filename="?([^";]+)"?/);
        name = match ? match[1] : 'report.csv';
      }

      
      const blob = new Blob([res.data], { type: 'text/csv' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      return true;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        (err.response?.status === 404 ? 'Report not found' : err.message) ||
        'Download failed';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { download, loading, error };
};

export default useCsvDownload;