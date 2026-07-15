import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../services/api';
import zkProofService from '../services/zkProofService';

const StudentDashboard = () => {
  const [sessionNonce, setSessionNonce] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [location, setLocation] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const navigate = useNavigate();

  const studentId = localStorage.getItem('userId');

  useEffect(() => {
    if (!studentId) {
      navigate('/login');
    }
    loadHistory();
  }, []);

  const loadHistory = async () => {
    // Fetch student's attendance history
    try {
      const response = await api.getStudentHistory(studentId);
      setAttendanceHistory(response);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const startScanning = () => {
    setScanning(true);
    const scanner = new Html5QrcodeScanner('qr-reader', {
      qrbox: { width: 250, height: 250 },
      fps: 10,
    });
    
    scanner.render(
      (decodedText) => {
        setSessionNonce(decodedText);
        fetchSessionData(decodedText);
        scanner.clear();
        setScanning(false);
      },
      (error) => console.error(error)
    );
  };

  const fetchSessionData = async (nonce) => {
    try {
      const data = await api.getSession(nonce);
      setSessionData(data);
      setMessage({ type: 'success', text: 'Session loaded! Please capture your location.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Invalid or expired session' });
    }
  };

  const captureLocation = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setMessage({ type: 'success', text: 'Location captured! Ready to submit.' });
        setLoading(false);
      },
      (error) => {
        setMessage({ type: 'error', text: 'Location access denied' });
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const submitAttendance = async () => {
    setLoading(true);
    setMessage({ type: 'info', text: 'Generating ZK proof...' });

    try {
      // Generate proof
      const { proof, publicSignals } = await zkProofService.generateProof(
        { lat: location.lat, lng: location.lng },
        sessionData
      );

      // Submit to server
      const response = await api.submitAttendance({
        session_nonce: sessionNonce,
        student_id: studentId,
        zk_proof: proof,
        public_signals: publicSignals
      });

      if (response.verified) {
        setMessage({ type: 'success', text: '✅ Attendance recorded successfully!' });
        setTimeout(() => {
          setSessionData(null);
          setLocation(null);
          setSessionNonce('');
          loadHistory();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: '❌ You are outside the classroom!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Student Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {studentId}</span>
            <button onClick={logout} className="text-red-600 hover:text-red-800">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Mark Attendance Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Mark Attendance</h2>
          
          {!sessionData ? (
            <div>
              <button
                onClick={startScanning}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-3"
              >
                Scan QR Code
              </button>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Or enter session code manually"
                  value={sessionNonce}
                  onChange={(e) => setSessionNonce(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                />
                <button
                  onClick={() => fetchSessionData(sessionNonce)}
                  disabled={!sessionNonce}
                  className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
                >
                  Load Session
                </button>
              </div>
              <div id="qr-reader" className={scanning ? 'block mt-4' : 'hidden'}></div>
            </div>
          ) : (
            <div>
              <div className="bg-gray-50 p-4 rounded mb-4">
                <p className="text-sm">Class Location: {sessionData.class_center_lat}, {sessionData.class_center_lng}</p>
                <p className="text-sm">Radius: {sessionData.radius_meters}m</p>
                <p className="text-sm">Valid until: {new Date(sessionData.end_time).toLocaleTimeString()}</p>
              </div>

              {!location ? (
                <button
                  onClick={captureLocation}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                >
                  Capture My Location
                </button>
              ) : (
                <div>
                  <div className="bg-blue-50 p-3 rounded mb-4">
                    <p className="text-sm">📍 Location captured</p>
                    <p className="text-xs">Accuracy: ±{Math.round(location.accuracy)}m</p>
                  </div>
                  <button
                    onClick={submitAttendance}
                    disabled={loading}
                    className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
                  >
                    {loading ? 'Generating Proof...' : 'Submit Attendance'}
                  </button>
                </div>
              )}
            </div>
          )}

          {message.text && (
            <div className={`mt-4 p-3 rounded ${
              message.type === 'success' ? 'bg-green-100 text-green-700' :
              message.type === 'error' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Attendance History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-3">Recent Attendance</h3>
          {attendanceHistory.length === 0 ? (
            <p className="text-gray-500 text-sm">No attendance records yet</p>
          ) : (
            <div className="space-y-2">
              {attendanceHistory.map((record, idx) => (
                <div key={idx} className="border-l-4 border-green-500 pl-3">
                  <p className="text-sm">Session: {record.session_nonce.substring(0, 16)}...</p>
                  <p className="text-xs text-gray-500">{new Date(record.verified_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;