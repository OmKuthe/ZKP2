// zkattend-mobile/app/screens/FaceVerifyScreen.tsx
/**
 * Face liveness verification — Step 2, Path 2 (blink transition).
 *
 * Fixes applied:
 *   - CameraView has NO children (Android crash fix)
 *   - Overlay is a sibling View with absolute positioning
 *   - onCameraReady guard before takePictureAsync
 *   - isMountedRef guard to prevent setState after unmount
 *   - handleVerified wrapped in try/catch
 *
 * StudentContext migration (file #9 of 9):
 *   - No longer reads route.params.studentId (identity comes from context)
 *   - Returns to Home via navigate('MainTabs', { screen: 'Home', params: { faceVerified } })
 *   - `faceVerified` remains the one-shot signal consumed by DashboardScreen
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import {
  FaceDetectionProvider,
  useFaceDetection,
  RNMLKitFaceDetectorOptions,
} from '@infinitered/react-native-mlkit-face-detection';

import { RootStackParamList } from '../types/navigation';

type FaceVerifyNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'FaceVerify'
>;

const FACE_DETECTION_OPTIONS: RNMLKitFaceDetectorOptions = {
  performanceMode: 'fast',
  classificationMode: true,
  landmarkMode: false,
  contourMode: false,
  minFaceSize: 0.15,
  isTrackingEnabled: false,
};

const FRAMES_PER_ATTEMPT = 8;
const FRAME_INTERVAL_MS = 300;
const MAX_ATTEMPTS = 3;
const EYE_CLOSED_THRESHOLD = 0.3;
const EYE_OPEN_THRESHOLD = 0.7;

interface FrameResult {
  leftOpen: number;
  rightOpen: number;
  isClosed: boolean;
  isOpen: boolean;
}

interface InnerProps {
  onVerified: (passed: boolean) => void;
  onCancel: () => void;
}

function FaceVerifyInner({ onVerified, onCancel }: InnerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const detector = useFaceDetection();
  const cameraRef = useRef<CameraView>(null);
  const isMountedRef = useRef(true);

  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState('Position your face inside the frame');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const captureFrame = async (): Promise<FrameResult | null> => {
    if (!cameraRef.current || !cameraReady) return null;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        base64: false,
      });
      if (!photo?.uri) return null;

      const result: any = await detector.detectFaces(photo.uri);
      const faces: any[] =
        result?.faces ?? result?.result?.faces ?? [];

      if (!Array.isArray(faces) || faces.length !== 1) return null;

      const face = faces[0];
      const leftOpen = face.leftEyeOpenProbability;
      const rightOpen = face.rightEyeOpenProbability;

      if (typeof leftOpen !== 'number' || typeof rightOpen !== 'number') {
        return null;
      }

      return {
        leftOpen,
        rightOpen,
        isClosed:
          leftOpen < EYE_CLOSED_THRESHOLD && rightOpen < EYE_CLOSED_THRESHOLD,
        isOpen:
          leftOpen > EYE_OPEN_THRESHOLD && rightOpen > EYE_OPEN_THRESHOLD,
      };
    } catch (err) {
      console.warn('🧠 FaceVerify: frame error:', err);
      return null;
    }
  };

  const runAttempt = async () => {
    if (busy || !cameraReady) return;
    setBusy(true);
    setStatus('Watching for a blink… please blink naturally');

    const frames: FrameResult[] = [];

    for (let i = 0; i < FRAMES_PER_ATTEMPT; i++) {
      if (!isMountedRef.current) return;
      setStatus(
        `Capturing frame ${i + 1}/${FRAMES_PER_ATTEMPT} — blink naturally`
      );
      const frame = await captureFrame();
      if (frame) frames.push(frame);

      if (i < FRAMES_PER_ATTEMPT - 1) {
        await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
      }
    }

    if (!isMountedRef.current) return;

    console.log(
      '🧠 FaceVerify sequence:',
      frames
        .map(
          (f) =>
            `L=${f.leftOpen.toFixed(2)} R=${f.rightOpen.toFixed(2)}` +
            (f.isClosed ? ' [CLOSED]' : f.isOpen ? ' [OPEN]' : '')
        )
        .join(' | ')
    );

    let sawClosed = false;
    let transitionDetected = false;

    for (const frame of frames) {
      if (frame.isClosed) {
        sawClosed = true;
      } else if (sawClosed && frame.isOpen) {
        transitionDetected = true;
        break;
      }
    }

    console.log(
      `🧠 FaceVerify: sawClosed=${sawClosed}, transition=${transitionDetected}`
    );

    if (transitionDetected) {
      setStatus('✅ Blink detected — liveness confirmed');
      setBusy(false);
      onVerified(true);
      return;
    }

    const remaining = attemptsLeft - 1;
    setAttemptsLeft(remaining);
    setBusy(false);

    if (remaining <= 0) {
      Alert.alert(
        'Face Verification Failed',
        'Could not detect a blink after 3 attempts. You can continue with check-in, but your session will be flagged for admin review.',
        [{ text: 'Continue', onPress: () => onVerified(false) }]
      );
      return;
    }

    const reason = !sawClosed
      ? 'No blink detected — please blink clearly and try again'
      : 'Blink detected but not confirmed — please try again';
    setStatus(
      `${reason} (${remaining} attempt${remaining === 1 ? '' : 's'} left)`
    );
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          Camera permission is required for face verification.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Skip (mark as failed)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ⚠️ CameraView must have NO children. Overlay is a sibling.
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} pointerEvents="none" />
        <Text style={styles.status} pointerEvents="none">
          {status}
        </Text>
        <Text style={styles.attempts} pointerEvents="none">
          Attempts left: {attemptsLeft} / {MAX_ATTEMPTS}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (busy || !cameraReady) && styles.buttonDisabled,
          ]}
          onPress={runAttempt}
          disabled={busy || !cameraReady}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {attemptsLeft === MAX_ATTEMPTS
                ? cameraReady
                  ? 'Start Verification'
                  : 'Starting camera…'
                : 'Retry'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const FaceVerifyScreen = () => {
  const navigation = useNavigation<FaceVerifyNavigationProp>();

  const handleVerified = (passed: boolean) => {
    try {
      // ✅ Home no longer takes studentId — identity lives in context.
      //    faceVerified is still the one-shot signal DashboardScreen reads.
      navigation.navigate('MainTabs', {
        screen: 'Home',
        params: { faceVerified: passed },
      });
    } catch (err) {
      console.error('❌ FaceVerify navigate error:', err);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Skip Face Verification?',
      'Your session will be marked as face-verification-failed and flagged for admin review.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Skip Anyway',
          style: 'destructive',
          onPress: () => handleVerified(false),
        },
      ]
    );
  };

  return (
    <FaceDetectionProvider options={FACE_DETECTION_OPTIONS}>
      <FaceVerifyInner onVerified={handleVerified} onCancel={handleCancel} />
    </FaceDetectionProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 260,
    height: 340,
    borderWidth: 3,
    borderColor: '#4F46E5',
    borderRadius: 140,
  },
  status: {
    color: '#fff',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  attempts: {
    color: '#c7d2fe',
    fontSize: 12,
    marginTop: 8,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#94a3b8', fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default FaceVerifyScreen;