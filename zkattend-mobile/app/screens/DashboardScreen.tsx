// app/screens/DashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';  // ✅ Import QR library
import { studentAPI } from '../api/client';
import { RootStackParamList } from '../types/navigation';

type DashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

type CheckInStatus = 
  | 'idle' 
  | 'requesting_location' 
  | 'verifying_location' 
  | 'requesting_qr' 
  | 'qr_received' 
  | 'scanning_qr' 
  | 'entry_complete' 
  | 'error';

const DashboardScreen = () => {
  const route = useRoute();
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { studentId } = route.params as { studentId: string };

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [internship, setInternship] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [studentName, setStudentName] = useState('');

  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [qrData, setQrData] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await studentAPI.getDashboard(studentId);
      setStudentName(response.data.student?.name || '');
      setInternship(response.data.active_internship || null);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const loadActiveSession = async () => {
    try {
      const response = await studentAPI.getActiveSession(studentId);
      setSession(response.data.active ? response.data.session : null);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await loadDashboard();
    await loadActiveSession();
    setRefreshing(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(loadActiveSession, 30000);
    return () => clearInterval(interval);
  }, []);

  const isWithinInternshipHours = () => {
    if (!internship) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = (internship.daily_start || '09:00').split(':').map(Number);
    const [endHour, endMin] = (internship.daily_end || '17:00').split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return currentTime >= startMinutes && currentTime <= endMinutes;
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => navigation.replace('Login')
        }
      ]
    );
  };

  const handleCheckIn = async () => {
    if (!internship) {
      Alert.alert('No Internship', 'You are not assigned to any active internship.');
      return;
    }
    if (session) {
      Alert.alert('Already Checked In', 'You already have an active session.');
      return;
    }

    if (!isWithinInternshipHours()) {
      Alert.alert('Outside Working Hours', `Internship hours are ${internship.daily_start} - ${internship.daily_end}. Please check in during working hours.`);
      return;
    }

    setCheckInStatus('requesting_location');
    setStatusMessage('📍 Requesting location...');
    setLoading(true);

    try {
      // Step 1: Get location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCheckInStatus('error');
        setStatusMessage('❌ Location permission denied');
        Alert.alert('Permission Denied', 'Location permission is required.');
        setLoading(false);
        return;
      }

      setStatusMessage('📍 Getting your location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Step 2: Verify location and get QR
      setStatusMessage('🔍 Verifying location...');
      setCheckInStatus('verifying_location');

      const response = await studentAPI.startEntry(
        studentId,
        location.coords.latitude,
        location.coords.longitude
      );

      const data = response.data;

      if (!data.verified) {
        setCheckInStatus('error');
        setStatusMessage(`❌ ${data.message}`);
        Alert.alert('Location Verification Failed', data.message);
        setLoading(false);
        return;
      }

      // Step 3: Show QR - ✅ 5 seconds to see it
      setStatusMessage('📱 QR generated! Scanning automatically...');
      setCheckInStatus('qr_received');
      setQrData(data.qr_data);
      setShowQRModal(true);

      // ✅ Wait 5 seconds so user can see the QR
      setTimeout(async () => {
        setStatusMessage('📷 Scanning QR...');
        setCheckInStatus('scanning_qr');

        try {
          const entryResponse = await studentAPI.completeEntry(
            studentId,
            data.qr_data.company_id,
            data.qr_data.token
          );

          setCheckInStatus('entry_complete');
          setStatusMessage('✅ Check-in successful!');
          setShowQRModal(false);
          
          Alert.alert('✅ Check In Successful', 'Session started successfully!');
          await refreshAll();
        } catch (error: any) {
          setCheckInStatus('error');
          setStatusMessage(`❌ ${error.response?.data?.detail || 'Failed to complete entry'}`);
          Alert.alert('Check-in Failed', error.response?.data?.detail || 'Failed to complete entry');
        }
      }, 5000);  // ✅ 5 seconds

    } catch (error: any) {
      setCheckInStatus('error');
      setStatusMessage(`❌ ${error.message}`);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check in.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!session) {
      Alert.alert('No Active Session', 'You are not checked in.');
      return;
    }

    setCheckInStatus('requesting_location');
    setStatusMessage('📍 Requesting location for exit...');
    setLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let latitude = 0;
      let longitude = 0;
      
      if (status === 'granted') {
        setStatusMessage('📍 Getting your location...');
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }

      setStatusMessage('🔍 Verifying location for exit...');
      const response = await studentAPI.startExit(studentId, latitude, longitude);
      const data = response.data;

      if (!data.verified && data.qr_data === null) {
        setCheckInStatus('error');
        setStatusMessage(`❌ ${data.message}`);
        Alert.alert('Exit Failed', data.message);
        setLoading(false);
        return;
      }

      setStatusMessage('📱 Exit QR generated!');
      setCheckInStatus('qr_received');
      setQrData(data.qr_data);
      setShowQRModal(true);

      // ✅ 5 seconds for exit QR too
      setTimeout(async () => {
        setStatusMessage('📷 Scanning exit QR...');
        setCheckInStatus('scanning_qr');

        try {
          const exitResponse = await studentAPI.completeExit(
            studentId,
            data.qr_data.company_id,
            data.qr_data.token
          );

          setCheckInStatus('entry_complete');
          setStatusMessage('✅ Check-out successful!');
          setShowQRModal(false);
          
          Alert.alert(
            '✅ Check Out Successful',
            `Duration: ${exitResponse.data.duration_minutes} minutes`
          );
          await refreshAll();
        } catch (error: any) {
          setCheckInStatus('error');
          setStatusMessage(`❌ ${error.response?.data?.detail || 'Failed to complete exit'}`);
          Alert.alert('Check-out Failed', error.response?.data?.detail || 'Failed to complete exit');
        }
      }, 5000);  // ✅ 5 seconds

    } catch (error: any) {
      setCheckInStatus('error');
      setStatusMessage(`❌ ${error.message}`);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check out.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = () => {
    if (session) return '✅ Checked In';
    if (internship?.can_start) return '🔵 Ready to Check In';
    return internship?.status_message || 'No Active Internship';
  };

  const isWithinHours = isWithinInternshipHours();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>ZKAttend</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {studentName || studentId}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Status</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: session ? '#16A34A' : '#4F46E5' }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {checkInStatus !== 'idle' && (
          <View style={styles.statusProgress}>
            <Text style={styles.statusProgressText}>{statusMessage}</Text>
            {checkInStatus !== 'error' && checkInStatus !== 'entry_complete' && (
              <ActivityIndicator size="small" color="#4F46E5" style={styles.statusSpinner} />
            )}
            {checkInStatus === 'error' && (
              <Text style={styles.statusError}>❌</Text>
            )}
            {checkInStatus === 'entry_complete' && (
              <Text style={styles.statusSuccess}>✅</Text>
            )}
          </View>
        )}

        {internship && (
          <View style={styles.internshipInfo}>
            <Text style={styles.companyName}>{internship.company_name}</Text>
            <Text style={styles.roleName}>{internship.role_name}</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Timings:</Text>
              <Text style={styles.detailsValue}>
                {internship.daily_start} - {internship.daily_end}
              </Text>
            </View>
            {!isWithinHours && !session && (
              <Text style={styles.warningText}>
                ⏰ Outside working hours. Check-in available {internship.daily_start} - {internship.daily_end}
              </Text>
            )}
            {internship.is_paid && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Stipend:</Text>
                <Text style={styles.detailsValue}>₹{internship.stipend_amount}/month</Text>
              </View>
            )}
            {session && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Duration:</Text>
                <Text style={styles.detailsValue}>{session.duration_minutes} minutes</Text>
              </View>
            )}
          </View>
        )}

        {!internship && (
          <Text style={styles.noInternship}>
            No active internship found. Please contact your coordinator.
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.checkInButton,
            (!internship?.can_start || session || !isWithinHours || loading) && styles.buttonDisabled,
          ]}
          onPress={handleCheckIn}
          disabled={!internship?.can_start || !!session || !isWithinHours || loading}
        >
          <Text style={styles.buttonText}>Check In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.checkOutButton,
            (!session || loading) && styles.buttonDisabled,
          ]}
          onPress={handleCheckOut}
          disabled={!session || loading}
        >
          <Text style={styles.buttonText}>Check Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        {internship?.is_paid ? '💰 Paid Internship' : '📋 Internship Active'}
      </Text>

      {/* ✅ QR Modal with REAL QR Code */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {qrData?.purpose === 'entry' ? '📱 Entry QR Code' : '📱 Exit QR Code'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Scanning automatically in 5 seconds...
            </Text>
            
            {/* ✅ Real QR Code */}
            <View style={styles.qrContainer}>
              {qrData && (
                <QRCode
                  value={JSON.stringify({
                    token: qrData.token,
                    student_id: qrData.student_id,
                    company_id: qrData.company_id,
                    timestamp: qrData.timestamp,
                    expires_at: qrData.expires_at,
                    purpose: qrData.purpose
                  })}
                  size={200}
                  color="#1a1a2e"
                  backgroundColor="white"
                />
              )}
            </View>

            <Text style={styles.qrTokenText}>
              Token: {qrData?.token?.substring(0, 16)}...
            </Text>

            <ActivityIndicator size="large" color="#4F46E5" style={styles.modalSpinner} />
            <Text style={styles.modalStatus}>{statusMessage}</Text>
            
            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={() => {
                setShowQRModal(false);
                setCheckInStatus('idle');
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: { backgroundColor: '#4F46E5', padding: 20, paddingTop: 48, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#c7d2fe', marginTop: 4 },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  statusProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statusProgressText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  statusSpinner: {
    marginLeft: 8,
  },
  statusError: {
    fontSize: 20,
    marginLeft: 8,
  },
  statusSuccess: {
    fontSize: 20,
    marginLeft: 8,
  },
  internshipInfo: { marginTop: 12 },
  companyName: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e' },
  roleName: { fontSize: 14, color: '#666', marginTop: 2, marginBottom: 8 },
  detailsRow: { flexDirection: 'row', marginTop: 4 },
  detailsLabel: { fontSize: 14, color: '#666', width: 100 },
  detailsValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
    fontWeight: '500',
  },
  noInternship: { color: '#999', textAlign: 'center', paddingVertical: 16 },
  actions: { paddingHorizontal: 16, gap: 12 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center' },
  checkInButton: { backgroundColor: '#4F46E5' },
  checkOutButton: { backgroundColor: '#DC2626' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  footer: { textAlign: 'center', color: '#666', fontSize: 12, padding: 16 },
  
  // ✅ QR Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4F46E5',
    marginBottom: 12,
  },
  qrTokenText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  modalSpinner: {
    marginTop: 8,
  },
  modalStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  modalCancelButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

export default DashboardScreen;