// zkattend-mobile/app/components/dashboard/RecentActivity.tsx
/**
 * Collapsed-by-default list of the last 5 verification logs.
 *
 * Full history lives in HistoryScreen. This component keeps the home
 * screen compact — no more 47-row scroll inside a card.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

export interface VerificationLog {
  time: string;
  counter: number;
  status: 'success' | 'failed' | 'info';
  message: string;
}

interface RecentActivityProps {
  logs: VerificationLog[];
  expanded: boolean;
  onToggle: () => void;
}

const MAX_VISIBLE = 5;

function statusIcon(status: VerificationLog['status']): string {
  switch (status) {
    case 'success':
      return '✅';
    case 'failed':
      return '❌';
    case 'info':
    default:
      return 'ℹ️';
  }
}

function counterLabel(counter: number): string {
  return counter < 0 ? '—' : `#${counter}`;
}

function shortenTime(time: string): string {
  // "14:03:22" → "14:03"
  const parts = time.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return time;
}

const RecentActivity: React.FC<RecentActivityProps> = ({
  logs,
  expanded,
  onToggle,
}) => {
  const recent = React.useMemo(() => {
    if (logs.length === 0) return [];
    const slice = logs.slice(-MAX_VISIBLE);
    return slice.reverse();
  }, [logs]);

  if (logs.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.header}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`Recent activity, ${logs.length} entries, tap to ${
          expanded ? 'collapse' : 'expand'
        }`}
      >
        <Text style={styles.headerTitle}>
          Recent activity ({logs.length})
        </Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.list}>
          {recent.map((log, index) => (
            <View key={index} style={styles.logRow}>
              <Text style={styles.logTime}>{shortenTime(log.time)}</Text>
              <Text style={styles.logCounter}>
                {counterLabel(log.counter)}
              </Text>
              <Text style={styles.logStatus}>{statusIcon(log.status)}</Text>
              <Text style={styles.logMessage} numberOfLines={1}>
                {log.message}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  chevron: {
    fontSize: 14,
    color: '#94a3b8',
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  logTime: {
    fontSize: 11,
    color: '#94a3b8',
    width: 44,
  },
  logCounter: {
    fontSize: 11,
    color: '#94a3b8',
    width: 32,
    textAlign: 'center',
  },
  logStatus: {
    fontSize: 12,
    width: 22,
    textAlign: 'center',
  },
  logMessage: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    marginLeft: 4,
  },
});

export default RecentActivity;