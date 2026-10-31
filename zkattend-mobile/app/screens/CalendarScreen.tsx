// zkattend-mobile/app/screens/CalendarScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

const PLANNED_FEATURES = [
  'Monthly attendance calendar with present / absent / anomaly markers',
  'Per-day detail: entry, exit, duration, verification status',
  'CSV export of any month — one row per day, one column per metric',
  'Per-internship view for coordinators',
];

const CalendarScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
      </View>

      <ScrollView style={styles.body}>
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>🗓</Text>
          <Text style={styles.heroTitle}>Coming in V2</Text>
          <Text style={styles.heroSubtitle}>
            The monthly attendance calendar and CSV export are on the roadmap
            for the next version.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Planned features</Text>

        <View style={styles.listCard}>
          {PLANNED_FEATURES.map((feature, index) => (
            <View
              key={index}
              style={[
                styles.listRow,
                index === PLANNED_FEATURES.length - 1 && styles.listRowLast,
              ]}
            >
              <View style={styles.bullet} />
              <Text style={styles.listText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          Until then, your current and past sessions are available from{' '}
          <Text style={styles.footnoteStrong}>History</Text>.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  body: { flex: 1 },
  heroCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginTop: 20, padding: 24, alignItems: 'center',
  },
  heroIcon: { fontSize: 40, marginBottom: 12 },
  heroTitle: {
    fontSize: 20, fontWeight: '700',
    color: '#1a1a2e', marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13, color: '#64748b',
    textAlign: 'center', lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#64748b',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 24, marginBottom: 8, marginHorizontal: 20,
  },
  listCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 12,
  },
  listRowLast: { borderBottomWidth: 0 },
  bullet: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#4F46E5', marginTop: 7,
  },
  listText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  footnote: {
    fontSize: 12, color: '#94a3b8', textAlign: 'center',
    marginTop: 24, marginHorizontal: 24, lineHeight: 18,
  },
  footnoteStrong: { color: '#4F46E5', fontWeight: '600' },
});

export default CalendarScreen;