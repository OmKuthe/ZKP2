import React, { useState } from 'react';
import api from '../services/api';

const FacultyDashboard = () => {
  const [sessionData, setSessionData] = useState({
    faculty_id: '',
    lat: '',
    lng: '',
    radius: 50,
    duration_minutes: 60
  });
  const [createdSession, setCreatedSession] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [viewNonce, setViewNonce] = useState('');

  const createSession = async (e) => {
    e.preventDefault();
    try {
      const response = await api.startSession({
        ...sessionData,
        lat: parseFloat(sessionData.lat),
        lng: parseFloat(sessionData.lng),
        radius: parseInt(sessionData.radius),
        duration_minutes: parseInt(sessionData.duration_minutes)
      });
      setCreatedSession(response);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session');
    }
  };

  const viewAttendance = async () => {
    try {
      const response = await api.getSessionAttendance(viewNonce);
      setAttendance(response);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      alert('Session not found');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Faculty Dashboard</h1>
        
        {/* Create Session Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Start New Session</h2>
          <form onSubmit={createSession} className="space-y-4">
            <input
              type="text"
              placeholder="Faculty ID"
              value={sessionData.faculty_id}
              onChange={(e) => setSessionData({...sessionData, faculty_id: e.target.value})}
              className="w-full p-2 border rounded"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={sessionData.lat}
                onChange={(e) => setSessionData({...sessionData, lat: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={sessionData.lng}
                onChange={(e) => setSessionData({...sessionData, lng: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Radius (meters)"
                value={sessionData.radius}
                onChange={(e) => setSessionData({...sessionData, radius: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="number"
                placeholder="Duration (minutes)"
                value={sessionData.duration_minutes}
                onChange={(e) => setSessionData({...sessionData, duration_minutes: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Create Session
            </button>
          </form>
          
          {createdSession && (
            <div className="mt-4 p-4 bg-green-50 rounded">
              <p className="font-semibold">Session Created!</p>
              <p className="text-sm break-all">Nonce: {createdSession.session_nonce}</p>
              <p className="text-sm">Valid until: {new Date(createdSession.end_time).toLocaleString()}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdSession.session_nonce);
                  alert('Nonce copied! Share with students');
                }}
                className="mt-2 bg-green-600 text-white px-4 py-1 rounded text-sm"
              >
                Copy Session Code
              </button>
            </div>
          )}
        </div>

        {/* View Attendance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">View Attendance</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Session Nonce"
              value={viewNonce}
              onChange={(e) => setViewNonce(e.target.value)}
              className="flex-1 p-2 border rounded"
            />
            <button onClick={viewAttendance} className="bg-gray-600 text-white px-4 rounded hover:bg-gray-700">
              Load
            </button>
          </div>
          
          {attendance && (
            <div>
              <p className="font-semibold">Total Present: {attendance.total_present}</p>
              <table className="w-full mt-4 border-collapse">
                <thead>
                  <tr><th className="border p-2 text-left">Student Hash</th>
                  <th className="border p-2 text-left">Verified At</th>
                </tr>
                </thead>
                <tbody>
                  {attendance.students.map((student, idx) => (
                    <tr key={idx}>
                      <td className="border p-2 text-sm break-all">{student.student_id_hash.substring(0, 16)}...</td>
                      <td className="border p-2 text-sm">{new Date(student.verified_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;