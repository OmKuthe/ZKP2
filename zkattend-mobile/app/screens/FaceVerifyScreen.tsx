// zkattend-mobile/app/screens/FaceVerifyScreen.tsx
/**
 * Face liveness verification — Step 2, Path 2 (blink transition).
 *
 * Captures 8 frames ~300ms apart (~2.4s total) and looks for an actual
 * blink transition: at least one frame with both eyes CLOSED, followed
 * by a later frame with both eyes OPEN.
 *
 * This is stronger than "eyes open in N frames" because a static photo
 * cannot produce a state change. A video replay could still pass, so
 * this remains a non-adversarial liveness check — but it closes the
 * "hold up a printed photo" gap.
 */
import React, { useRef, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
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

// ============================================================
// Detector options — classificationMode MUST be true
// ============================================================
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

// Blink transition thresholds
const EYE_CLOSED_THRESHOLD = 0.3;  // both eyes below this = closed
const EYE_OPEN_THRESHOLD = 0.7;    // both eyes above this = open

interface FrameResult {
  leftOpen: number;
  rightOpen: number;
  isClosed: boolean;
  isOpen: boolean;
}

// ============================================================
// Inner component
// ============================================================

interface InnerProps {
  onVerified: (passed: boolean) => void;
  onCancel: () => void;
}

function FaceVerifyInner({ onVerified, onCancel }: InnerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const detector = useFaceDetection();
  const cameraRef = useRef<CameraView>(null);

  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Position your face inside the frame');

  // Capture a single frame and extract eye-open probabilities.
  const captureFrame = async (): Promise<FrameResult | null> => {
    if (!cameraRef.current) return null;

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

  // One attempt = 8 frames. Look for closed → open transition.
  const runAttempt = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('Watching for a blink… please blink naturally');

    const frames: FrameResult[] = [];

    for (let i = 0; i < FRAMES_PER_ATTEMPT; i++) {
      setStatus(
        `Capturing frame ${i + 1}/${FRAMES_PER_ATTEMPT} — blink naturally`
      );
      const frame = await captureFrame();
      if (frame) frames.push(frame);

      if (i < FRAMES_PER_ATTEMPT - 1) {
        await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
      }
    }

    // Log the sequence for debugging
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

    // Check for closed → open transition
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

  // ----------------------------------------------------------
  // Permission handling
  // ----------------------------------------------------------
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

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.attempts}>
          Attempts left: {attemptsLeft} / {MAX_ATTEMPTS}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.buttonDisabled]}
          onPress={runAttempt}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {attemptsLeft === MAX_ATTEMPTS ? 'Start Verification' : 'Retry'}
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

// ============================================================
// Outer screen
// ============================================================

const FaceVerifyScreen = () => {
  const navigation = useNavigation<FaceVerifyNavigationProp>();
  const route = useRoute();
  const { studentId } = route.params as { studentId: string };

  const handleVerified = (passed: boolean) => {
    navigation.navigate({
      name: 'Dashboard',
      params: { studentId, faceVerified: passed } as any,
      merge: true,
    });
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
  camera: { flex: 1 },
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
    padding: 20,
    backgroundColor: '#000',
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