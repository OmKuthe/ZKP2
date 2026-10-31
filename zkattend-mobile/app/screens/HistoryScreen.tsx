// zkattend-mobile/app/screens/HistoryScreen.tsx
/**
 * History tab — current session continuity timeline.
 *
 * Reads `studentId` from context (useRequiredStudentId) instead of route
 * params, per the StudentContext migration (file #6 of 9).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { studentAPI } from '../api/client';
import { useRequiredStudentId } from '../context/StudentContext';
import TrackingTimeline from '../components/TrackingTimeline';

interface ContinuityCheck {
  id: number;
  check_number: number;
  check_time: string;
  status: string;
  message: string;
}

interface ActiveSession {
  active: boolean;
  session: {
    session_id: string;
    entry_time: string;
    status: string;
    duration_minutes: number;
  } | null;
}

const HistoryScreen = () => {
  const studentId = useRequiredStudentId();

  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeChecks, setActiveChecks] = useState<ContinuityCheck[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const activeResp = await studentAPI.getActiveSession(studentId);
        const active = activeResp.data as ActiveSession;
        setActiveSession(active);

        if (active.active && active.session) {
          const checksResp = await studentAPI.getContinuityChecks(
            active.session.session_id
          );
          setActiveChecks(checksResp.data.checks || []);
        }
      } catch (err: any) {
        console.error('❌ Failed to load active session:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [studentId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      <ScrollView style={styles.body}>
        <Text style={styles.sectionTitle}>This session</Text>

        {loading && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        )}

        {!loading && activeSession?.active && activeSession.session && (
          <TrackingTimeline
            checks={activeChecks}
            entryTime={activeSession.session.entry_time}
            exitTime={null}
          />
        )}

        {!loading && !activeSession?.active && (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>No session in progress.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Past sessions</Text>

        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonIcon}>🗂</Text>
          <Text style={styles.comingSoonTitle}>Coming in V2</Text>
          <Text style={styles.comingSoonText}>
            A full list of past sessions with per-day detail will appear here.
          </Text>
        </View>

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
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#64748b',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 8, marginHorizontal: 20,
  },
  loadingBlock: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 24, gap: 10,
  },
  loadingText: { fontSize: 13, color: '#94a3b8' },
  emptyBlock: {
    backgroundColor: '#fff', borderRadius: 12,
    marginHorizontal: 16, padding: 24, alignItems: 'center',
  },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  comingSoonCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, padding: 24, alignItems: 'center',
  },
  comingSoonIcon: { fontSize: 32, marginBottom: 8 },
  comingSoonTitle: {
    fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 4,
  },
  comingSoonText: {
    fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19,
  },
});

export default HistoryScreen;