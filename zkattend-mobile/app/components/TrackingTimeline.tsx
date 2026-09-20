// zkattend-mobile/app/components/TrackingTimeline.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface Check {
  id: number;
  check_number: number;
  check_time: string;
  status: string;
  message: string;
}

interface TrackingTimelineProps {
  checks: Check[];
  entryTime: string | null;
  exitTime?: string | null;
}

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ 
  checks, 
  entryTime, 
  exitTime 
}) => {
  const totalChecks = checks.length;
  const verifiedChecks = checks.filter(c => c.status === 'verified').length;
  const failedChecks = checks.filter(c => c.status === 'failed').length;

  return (
    <View style={styles.container}>
      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={[styles.statItem, styles.statTotal]}>
          <Text style={styles.statNumber}>{totalChecks}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statItem, styles.statVerified]}>
          <Text style={[styles.statNumber, styles.statVerifiedText]}>{verifiedChecks}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={[styles.statItem, styles.statFailed]}>
          <Text style={[styles.statNumber, styles.statFailedText]}>{failedChecks}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${Math.min((totalChecks / 10) * 100, 100)}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{Math.min(totalChecks, 10)}/10 checks</Text>
      </View>

      {/* Timeline */}
      <ScrollView style={styles.timeline}>
        {/* Entry */}
        <View style={styles.timelineItem}>
          <View style={[styles.dot, styles.dotGreen]} />
          <View style={styles.content}>
            <Text style={styles.title}>✅ Entry</Text>
            <Text style={styles.time}>
              {entryTime ? new Date(entryTime).toLocaleTimeString() : '—'}
            </Text>
            <Text style={styles.message}>Session started</Text>
          </View>
        </View>

        {/* Checks */}
        {checks.map((check) => (
          <View key={check.id} style={styles.timelineItem}>
            <View style={[
              styles.dot,
              check.status === 'verified' ? styles.dotGreen :
              check.status === 'failed' ? styles.dotRed :
              styles.dotYellow
            ]} />
            <View style={styles.content}>
              <Text style={styles.title}>
                Check #{check.check_number}
                <Text style={[
                  styles.badge,
                  check.status === 'verified' ? styles.badgeGreen :
                  check.status === 'failed' ? styles.badgeRed :
                  styles.badgeYellow
                ]}>
                  {' '}{check.status}
                </Text>
              </Text>
              <Text style={styles.time}>
                {new Date(check.check_time).toLocaleTimeString()}
              </Text>
              <Text style={styles.message}>
                {check.message || 'Hash chain verification'}
              </Text>
            </View>
          </View>
        ))}

        {/* Pending next check */}
        <View style={styles.timelineItem}>
          <View style={[styles.dot, styles.dotGray]} />
          <View style={styles.content}>
            <Text style={[styles.title, styles.pendingText]}>Next Check</Text>
            <Text style={[styles.time, styles.pendingText]}>
              Waiting for next verification...
            </Text>
          </View>
        </View>

        {/* Exit */}
        <View style={styles.timelineItem}>
          <View style={[styles.dot, exitTime ? styles.dotGray : styles.dotDashed]} />
          <View style={styles.content}>
            <Text style={[styles.title, exitTime ? styles.title : styles.pendingText]}>
              {exitTime ? '⬛ Exit' : 'Exit (Pending)'}
            </Text>
            <Text style={[styles.time, exitTime ? styles.time : styles.pendingText]}>
              {exitTime ? new Date(exitTime).toLocaleTimeString() : 'Waiting for checkout...'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 60,
  },
  statTotal: {
    backgroundColor: '#F1F5F9',
  },
  statVerified: {
    backgroundColor: '#D1FAE5',
  },
  statFailed: {
    backgroundColor: '#FEE2E2',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  statVerifiedText: {
    color: '#065F46',
  },
  statFailedText: {
    color: '#991B1B',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'right',
  },
  timeline: {
    maxHeight: 400,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingLeft: 4,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 14,
    marginTop: 3,
  },
  dotGreen: { backgroundColor: '#16A34A' },
  dotRed: { backgroundColor: '#DC2626' },
  dotYellow: { backgroundColor: '#F59E0B' },
  dotGray: { backgroundColor: '#94A3B8' },
  dotDashed: { 
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  pendingText: {
    color: '#94A3B8',
  },
  time: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  message: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  badge: {
    fontSize: 9,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 4,
  },
  badgeGreen: { 
    backgroundColor: '#D1FAE5', 
    color: '#065F46',
  },
  badgeRed: { 
    backgroundColor: '#FEE2E2', 
    color: '#991B1B',
  },
  badgeYellow: { 
    backgroundColor: '#FEF3C7', 
    color: '#92400E',
  },
});

export default TrackingTimeline;