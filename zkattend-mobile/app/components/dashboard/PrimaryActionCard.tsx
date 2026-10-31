// zkattend-mobile/app/components/dashboard/PrimaryActionCard.tsx
/**
 * Hero card for the home screen — the primary action surface.
 *
 * Three states:
 *   - Ready   : no session, can check in
 *   - Active  : session exists, shows duration/counter/countdown, Check Out
 *   - Blocked : no internship, or outside working hours, Check In disabled
 *
 * Pure presentation. No navigation, no alerts, no API calls.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

export interface PrimaryActionInternship {
  company_name: string;
  role_name: string;
  daily_start: string;
  daily_end: string;
}

interface PrimaryActionCardProps {
  hasSession: boolean;
  internship: PrimaryActionInternship | null;
  isWithinHours: boolean;
  durationMinutes: number | null;
  counter: number;
  nextCheckIn: number;
  loading: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onVerifyNow: () => void;
}

const PrimaryActionCard: React.FC<PrimaryActionCardProps> = ({
  hasSession,
  internship,
  isWithinHours,
  durationMinutes,
  counter,
  nextCheckIn,
  loading,
  onCheckIn,
  onCheckOut,
  onVerifyNow,
}) => {
  // ---------- Active state ----------
  if (hasSession) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: '#16A34A' }]} />
          <Text style={styles.title}>Checked in</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {durationMinutes !== null ? `${durationMinutes}m` : '—'}
            </Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricValue}>{counter}/100</Text>
            <Text style={styles.metricLabel}>Counter</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Text style={styles.metricValue}>{nextCheckIn}s</Text>
            <Text style={styles.metricLabel}>Next check</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={onVerifyNow}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Verify Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.dangerButton, loading && styles.buttonDisabled]}
            onPress={onCheckOut}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Check Out</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Blocked state ----------
  if (!internship || !isWithinHours) {
    const reason = !internship
      ? 'No active internship. Contact your coordinator.'
      : `Outside working hours: ${internship.daily_start} – ${internship.daily_end}`;

    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: '#94a3b8' }]} />
          <Text style={styles.title}>Not ready to check in</Text>
        </View>

        {internship && (
          <>
            <Text style={styles.companyName}>{internship.company_name}</Text>
            <Text style={styles.roleName}>{internship.role_name}</Text>
          </>
        )}

        <Text style={styles.reason}>{reason}</Text>

        <TouchableOpacity style={[styles.button, styles.buttonDisabled]}>
          <Text style={styles.buttonTextMuted}>Check In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Ready state ----------
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: '#4F46E5' }]} />
        <Text style={styles.title}>Ready to check in</Text>
      </View>

      <Text style={styles.companyName}>{internship.company_name}</Text>
      <Text style={styles.roleName}>{internship.role_name}</Text>

      <Text style={styles.timings}>
        {internship.daily_start} – {internship.daily_end}
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={onCheckIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Check In</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginTop: 4,
  },
  roleName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timings: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  reason: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    marginTop: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  secondaryButtonText: {
    color: '#8B5CF6',
    fontSize: 15,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextMuted: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});

export default PrimaryActionCard;