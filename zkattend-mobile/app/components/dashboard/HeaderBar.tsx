// zkattend-mobile/app/components/dashboard/HeaderBar.tsx
/**
 * Compact header for the home screen.
 *
 * Left  : app name
 * Right : student name + Logout button
 * Below : semantic status pill
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

export type HeaderStatus =
  | 'not_active'
  | 'verifying'
  | 'verified'
  | 'anomaly'
  | 'paused';

interface HeaderBarProps {
  studentName: string;
  studentId: string;
  status: HeaderStatus;
  onLogout: () => void;
}

interface StatusConfig {
  color: string;
  label: string;
  icon: string;
}

function getStatusConfig(status: HeaderStatus): StatusConfig {
  switch (status) {
    case 'verified':
      return { color: '#16A34A', label: 'Verified', icon: '●' };
    case 'verifying':
      return { color: '#F59E0B', label: 'Verifying', icon: '●' };
    case 'anomaly':
      return { color: '#DC2626', label: 'Anomaly', icon: '●' };
    case 'paused':
      return { color: '#F59E0B', label: 'Paused', icon: '⏸' };
    case 'not_active':
    default:
      return { color: '#94a3b8', label: 'Not active', icon: '●' };
  }
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  studentName,
  studentId,
  status,
  onLogout,
}) => {
  const config = getStatusConfig(status);
  const displayName = studentName || studentId;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.title}>ZKAttend</Text>

        <View style={styles.rightBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>

          <TouchableOpacity
            onPress={onLogout}
            style={styles.logoutButton}
            activeOpacity={0.6}
            accessibilityLabel="Logout"
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.pillRow}>
        <View
          style={[styles.statusPill, { backgroundColor: config.color + '22' }]}
        >
          <Text style={[styles.statusIcon, { color: config.color }]}>
            {config.icon}
          </Text>
          <Text style={[styles.statusLabel, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  rightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  name: {
    color: '#c7d2fe',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 12,
    maxWidth: 140,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pillRow: {
    marginTop: 12,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusIcon: {
    fontSize: 10,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default HeaderBar;