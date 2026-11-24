// zkattend-mobile/app/components/ChallengeModal.tsx
/**
 * Re-verify challenge modal.
 *
 * Triggered when `verificationLoop` detects a pending challenge
 * (backend issued it because of WiFi fail escalation).
 *
 * Student must scan face within the countdown. On "Scan Face":
 *   - Navigates to FaceVerifyScreen with challengeId
 *   - FaceVerifyScreen calls respondToChallenge on completion
 *
 * This modal itself does NOT do the face check — it just shows and routes.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types/navigation';
import { studentAPI } from '../api/client';

export interface PendingChallenge {
  challengeId: number;
  sessionId: string;
  issuedAt: string;
  expiresAt: string;
  reason?: string;
}

interface Props {
  challenge: PendingChallenge | null;
  onDismiss: () => void;
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function useCountdown(expiresAt: string): number {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(
        Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      );
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

const ChallengeModal = ({ challenge, onDismiss }: Props) => {
  const navigation = useNavigation<NavProp>();
  const remaining = useCountdown(
    challenge?.expiresAt || new Date(Date.now() + 300_000).toISOString()
  );

  // Auto-dismiss when countdown hits 0 — backend sweeper will flag the session
  useEffect(() => {
    if (challenge && remaining <= 0) {
      console.log('⏱ Challenge expired — dismissing modal');
      onDismiss();
    }
  }, [challenge, remaining, onDismiss]);

  if (!challenge) return null;

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const timeStr = `${mm}:${String(ss).padStart(2, '0')}`;
  const isUrgent = remaining < 60;

  const handleScanFace = () => {
    // Navigate to FaceVerifyScreen with the challenge id.
    // FaceVerifyScreen reports the result via respondToChallenge.
    navigation.navigate('FaceVerify', { challengeId: challenge.challengeId });
    onDismiss();
  };

  const handleSkip = async () => {
    Alert.alert(
      'Skip Re-verify?',
      'If you skip, your session will be flagged for admin review. Are you sure?',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            try {
              await studentAPI.respondToChallenge(
                challenge.challengeId,
                false,
                'student_skipped'
              );
            } catch (err) {
              console.warn('⚠️ Skip response failed:', err);
            }
            onDismiss();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={!!challenge}
      transparent
      animationType="fade"
      // Prevent hardware back dismiss — student must interact
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🔐</Text>
          </View>

          <Text style={styles.title}>Verify Your Presence</Text>
          <Text style={styles.subtitle}>
            Our verification system detected a Wi-Fi anomaly. Please confirm
            you're still on-site by scanning your face.
          </Text>

          <View style={[styles.timer, isUrgent && styles.timerUrgent]}>
            <Text style={styles.timerLabel}>Time remaining</Text>
            <Text style={[styles.timerValue, isUrgent && styles.timerValueUrgent]}>
              {timeStr}
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleScanFace}>
            <Text style={styles.primaryButtonText}>📷 Scan Face Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip (flags session)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 36 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  timer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 24,
    alignItems: 'center',
    minWidth: 160,
  },
  timerUrgent: { backgroundColor: '#FEE2E2' },
  timerLabel: {
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a2e',
    fontVariant: ['tabular-nums'],
  },
  timerValueUrgent: { color: '#DC2626' },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});

export default ChallengeModal;