// app/screens/QRScannerScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { useRequiredStudentId } from '../context/StudentContext';
import { RootStackParamList } from '../types/navigation';

type QRScannerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'QRScanner'
>;

const QRScannerScreen = () => {
  const route = useRoute();
  const navigation = useNavigation<QRScannerScreenNavigationProp>();
  const studentId = useRequiredStudentId();
  const { qrPayload, purpose = 'entry' } = route.params as {
    qrPayload?: any;
    purpose?: 'entry' | 'exit';
  };

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (qrPayload && purpose === 'entry') {
      handleQRScan(qrPayload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQRScan = async (data: any) => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);

    try {
      if (purpose === 'entry') {
        await api.post('/student/entry', {
          student_id: studentId,
          company_id: data.company_id,
          qr_token: data.token,
        });
        Alert.alert('✅ Success', 'Checked in successfully!', [
          {
            text: 'OK',
            onPress: () =>
              navigation.replace('MainTabs', { screen: 'Home' }),
          },
        ]);
      } else {
        const response = await api.post('/student/exit', {
          student_id: studentId,
          company_id: data.company_id,
          qr_token: data.token,
        });
        Alert.alert(
          '✅ Success',
          `Checked out! Duration: ${response.data.duration_minutes} min`,
          [
            {
              text: 'OK',
              onPress: () =>
                navigation.replace('MainTabs', { screen: 'Home' }),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('❌ QR Error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to process QR',
        [
          { text: 'Retry', onPress: () => setScanning(true) },
          { text: 'Cancel', onPress: () => navigation.goBack() },
        ]
      );
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera Permission Required</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={({ data }) => {
          if (!scanning || loading) return;
          try {
            const parsed = JSON.parse(data);
            handleQRScan(parsed);
          } catch {}
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.instruction}>
          {purpose === 'entry' ? '📷 Scan Entry QR' : '📷 Scan Exit QR'}
        </Text>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  cancelButtonText: { color: '#fff', fontSize: 14 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 12 },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default QRScannerScreen;