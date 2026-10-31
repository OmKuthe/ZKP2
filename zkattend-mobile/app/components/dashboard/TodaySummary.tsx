// zkattend-mobile/app/components/dashboard/TodaySummary.tsx
/**
 * Compact 3-row summary of today's session.
 *
 * Rows:
 *   - Entry time (formatted HH:MM)
 *   - Duration (Xh Ym, or — if not yet computed)
 *   - Anomaly count (color-coded: 0 gray, 1-2 amber, 3+ red)
 *
 * No company info, no stipend — those live in ProfileScreen.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TodaySummaryProps {
  entryTime: string | null;
  durationMinutes: number | null;
  anomalyCount: number;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function anomalyColor(count: number): string {
  if (count === 0) return '#94a3b8';
  if (count <= 2) return '#F59E0B';
  return '#DC2626';
}

function anomalyLabel(count: number): string {
  if (count === 0) return 'None';
  if (count === 1) return '1 flagged';
  return `${count} flagged`;
}

const TodaySummary: React.FC<TodaySummaryProps> = ({
  entryTime,
  durationMinutes,
  anomalyCount,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Entry</Text>
        <Text style={styles.rowValue}>{formatTime(entryTime)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Duration</Text>
        <Text style={styles.rowValue}>{formatDuration(durationMinutes)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Anomalies</Text>
        <Text
          style={[
            styles.rowValue,
            { color: anomalyColor(anomalyCount) },
          ]}
        >
          {anomalyLabel(anomalyCount)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: '#666',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
});

export default TodaySummary;