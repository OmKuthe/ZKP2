// app/components/StatusBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'checkin' | 'checkout' | 'pending';
  label?: string;
}

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return { bg: '#16A34A', text: 'Active' };
      case 'inactive':
        return { bg: '#94A3B8', text: 'Inactive' };
      case 'checkin':
        return { bg: '#4F46E5', text: 'Checked In' };
      case 'checkout':
        return { bg: '#DC2626', text: 'Checked Out' };
      case 'pending':
        return { bg: '#F59E0B', text: 'Pending' };
      default:
        return { bg: '#94A3B8', text: 'Unknown' };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={styles.text}>{label || config.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default StatusBadge;