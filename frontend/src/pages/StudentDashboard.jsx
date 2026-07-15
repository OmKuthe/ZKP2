import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../services/api';
import zkProofService from '../services/zkProofService';

const StudentView = () => {
  const [sessionNonce, setSessionNonce] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [location, setLocation] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [manualEntry, setManualEntry] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState(null);

  // Initialize QR scanner
  useEffect(() => {
    if (scanning && !manualEntry) {
      const scanner = new Html5QrcodeScanner('qr-reader', {
        qrbox: { width: 250, height: 250 },
        fps: 10,
      });
      
      scanner.render(onScanSuccess, onScanError);
      
      return () => {
        scanner.clear();
      };
    }
  }, [scanning, manualEntry]);

  const onScanSuccess = (decodedText) => {
    setSessionNonce(decodedText);
    fetchSessionData(decodedText);
    setScanning(false);
    setMessage({ type: 'success', text: 'QR Code scanned successfully!' });
  };

  const onScanError = (err) => {
    console.error('QR Scan error:', err);
  };

  const fetchSessionData = async (nonce) => {
    try {
      setLoading(true);
      const response = await api.getSession(nonce);
      setSessionData(response);
      setMessage({ type: 'success', text: 'Session loaded! Now capture your location.' });
    } catch (error) {
      console.error('Error fetching session:', error);
      setMessage({ type: 'error', text: 'Invalid or expired session QR code' });
      setSessionNonce('');
    } finally {
      setLoading(false);
    }
  };

  const captureLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation not supported by your browser' });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy
        });
        setMessage({ 
          type: 'success', 
          text: `Location captured! Accuracy: ±${Math.round(accuracy)} meters` 
        });
        setLoading(false);
      },
      (error) => {
        console.error('Location error:', error);
        let errorMsg = 'Failed to get location. ';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Please allow location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMsg += 'Location request timed out.';
            break;
        }
        setMessage({ type: 'error', text: errorMsg });
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const submitAttendance = async () => {
    if (!studentId || !sessionData || !location) {
      setMessage({ type: 'error', text: 'Missing required information' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Generating zero-knowledge proof...' });

    try {
      // Generate REAL ZK proof
      const { proof, publicSignals } = await zkProofService.generateProof(
        { lat: location.lat, lng: location.lng },
        {
          class_center_lat: sessionData.class_center_lat,
          class_center_lng: sessionData.class_center_lng,
          radius_meters: sessionData.radius_meters
        }
      );

      setMessage({ type: 'info', text: 'Proof generated! Verifying with server...' });

      // Submit to backend
      const attendanceData = {
        session_nonce: sessionNonce,
        student_id: studentId,
        zk_proof: proof,
        public_signals: publicSignals
      };

      const response = await api.submitAttendance(attendanceData);
      
      if (response.verified) {
        setAttendanceStatus({
          verified: true,
          recordId: response.record_id,
          timestamp: new Date().toLocaleString()
        });
        setMessage({ type: 'success', text: '✅ Attendance verified and recorded!' });
      } else {
        setMessage({ type: 'error', text: '❌ Verification failed - you may be outside the classroom' });
      }
    } catch (error) {
      console.error('Attendance submission error:', error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSessionNonce('');
    setSessionData(null);
    setStudentId('');
    setLocation(null);
    setScanning(false);
    setManualEntry(false);
    setAttendanceStatus(null);
    setMessage({ type: '', text: '' });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">ZKAttend Student Portal</h1>
          <p className="text-gray-600 mb-6">Privacy-preserving attendance using zero-knowledge proofs</p>

          {!sessionData ? (
            <div>
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => { setScanning(true); setManualEntry(false); }}
                  className={`flex-1 py-2 px-4 rounded ${!manualEntry ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Scan QR Code
                </button>
                <button
                  onClick={() => { setManualEntry(true); setScanning(false); }}
                  className={`flex-1 py-2 px-4 rounded ${manualEntry ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Enter Manually
                </button>
              </div>

              {scanning && !manualEntry && (
                <div>
                  <div id="qr-reader" className="w-full"></div>
                  <p className="text-sm text-gray-500 mt-2 text-center">Scan session QR code from faculty dashboard</p>
                </div>
              )}

              {manualEntry && (
                <div>
                  <input
                    type="text"
                    placeholder="Enter Session Code"
                    value={sessionNonce}
                    onChange={(e) => setSessionNonce(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
                  />
                  <button
                    onClick={() => fetchSessionData(sessionNonce)}
                    disabled={!sessionNonce}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Load Session
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Session Info */}
              <div className="bg-gray-50 p-4 rounded mb-6">
                <h3 className="font-semibold mb-2">Session Details</h3>
                <p className="text-sm">Class Center: {sessionData.class_center_lat}, {sessionData.class_center_lng}</p>
                <p className="text-sm">Radius: {sessionData.radius_meters} meters</p>
                <p className="text-sm">Valid until: {new Date(sessionData.end_time).toLocaleString()}</p>
              </div>

              {/* Student ID Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student ID / Roll Number
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter your student ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                  disabled={!!attendanceStatus}
                />
              </div>

              {/* Location Capture */}
              {!location && !attendanceStatus && (
                <button
                  onClick={captureLocation}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400 mb-4"
                >
                  {loading ? 'Capturing...' : 'Capture My Location'}
                </button>
              )}

              {location && !attendanceStatus && (
                <div className="mb-6">
                  <div className="bg-blue-50 p-3 rounded mb-4">
                    <p className="text-sm font-semibold">📍 Location Captured</p>
                    <p className="text-xs">Lat: {location.lat.toFixed(6)}</p>
                    <p className="text-xs">Lng: {location.lng.toFixed(6)}</p>
                    <p className="text-xs">Accuracy: ±{Math.round(location.accuracy)}m</p>
                  </div>
                  
                  <button
                    onClick={submitAttendance}
                    disabled={loading || !studentId}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:bg-gray-400"
                  >
                    {loading ? 'Generating ZK Proof & Submitting...' : 'Submit Attendance with ZK Proof'}
                  </button>
                </div>
              )}

              {/* Attendance Status */}
              {attendanceStatus && (
                <div className={`p-4 rounded ${attendanceStatus.verified ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'}`}>
                  <h3 className="font-bold mb-2">
                    {attendanceStatus.verified ? '✅ Attendance Confirmed!' : '❌ Attendance Failed'}
                  </h3>
                  {attendanceStatus.verified && (
                    <>
                      <p className="text-sm">Record ID: {attendanceStatus.recordId}</p>
                      <p className="text-sm">Time: {attendanceStatus.timestamp}</p>
                      <p className="text-xs text-green-700 mt-2">
                        🔒 Your exact location remains private. Only a cryptographic proof was submitted.
                      </p>
                    </>
                  )}
                  <button
                    onClick={resetForm}
                    className="mt-4 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    ← Start Over
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Message Display */}
          {message.text && (
            <div className={`mt-4 p-3 rounded ${
              message.type === 'success' ? 'bg-green-100 text-green-700' :
              message.type === 'error' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* Privacy Notice */}
          <div className="mt-6 text-xs text-gray-500 text-center border-t pt-4">
            🔒 Your location data never leaves your device. Only a zero-knowledge proof is submitted.
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentView;