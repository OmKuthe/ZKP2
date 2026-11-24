// zkattend-mobile/app/screens/HistoryScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
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

interface PastSession {
  id: number;
  session_id: string;
  internship_id: number | null;
  company_name: string | null;
  internship_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  status: string;
  zkp_verified: boolean | null;
  face_verified: boolean | null;
  wifi_verified: boolean | null;
  chain_verified: boolean | null;
  overall_verified: boolean | null;
  anomaly_count: number;
}

interface SessionsResponse {
  sessions: PastSession[];
  total: number;
  page: number;
  limit: number;
}

// ---------- helpers ----------

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  if (isToday) return 'Today';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// ---------- subcomponents ----------

interface BadgeProps {
  label: string;
  ok: boolean | null;
}

const Badge = ({ label, ok }: BadgeProps) => {
  const bg =
    ok === true ? '#16A34A' :    // success-500
    ok === false ? '#DC2626' :   // danger-500
    '#CBD5E1';                    // slate-300
  const color = ok === null ? '#475569' : '#fff';
  const symbol = ok === true ? '✓' : ok === false ? '✗' : '—';

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>
        {label} {symbol}
      </Text>
    </View>
  );
};

interface StatusPillProps {
  status: string;
}

const StatusPill = ({ status }: StatusPillProps) => {
  const styles_ = {
    active:    { bg: '#F59E0B', label: 'Active' },
    closed:    { bg: '#16A34A', label: 'Closed' },
    flagged:   { bg: '#DC2626', label: 'Flagged' },
    abandoned: { bg: '#64748B', label: 'Abandoned' },
  } as const;
  const meta = (styles_ as any)[status] || { bg: '#94A3B8', label: status };
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Text style={styles.statusPillText}>{meta.label}</Text>
    </View>
  );
};

interface SessionRowProps {
  session: PastSession;
  expanded: boolean;
  onToggle: () => void;
}

const SessionRow = ({ session, expanded, onToggle }: SessionRowProps) => {
  return (
    <TouchableOpacity
      style={styles.sessionRow}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.sessionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sessionDate}>{fmtDate(session.started_at)}</Text>
          <Text style={styles.sessionTime}>
            {fmtTime(session.started_at)} → {fmtTime(session.ended_at)}
            {' · '}
            {fmtDuration(session.duration_minutes)}
          </Text>
        </View>
        <StatusPill status={session.status} />
      </View>

      {session.anomaly_count > 0 && (
        <Text style={styles.anomalyNote}>
          ⚠️ {session.anomaly_count} anomaly{session.anomaly_count === 1 ? '' : 'ies'}
        </Text>
      )}

      {expanded && (
        <View style={styles.badgeRow}>
          <Badge label="ZKP" ok={session.zkp_verified} />
          <Badge label="Face" ok={session.face_verified} />
          <Badge label="WiFi" ok={session.wifi_verified} />
          <Badge label="Chain" ok={session.chain_verified} />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ---------- main component ----------

const HistoryScreen = () => {
  const studentId = useRequiredStudentId();

  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingPast, setLoadingPast] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeChecks, setActiveChecks] = useState<ContinuityCheck[]>([]);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    // Load active session (existing behavior)
    setLoadingActive(true);
    try {
      const activeResp = await studentAPI.getActiveSession(studentId);
      const active = activeResp.data as ActiveSession;
      setActiveSession(active);

      if (active.active && active.session) {
        const checksResp = await studentAPI.getContinuityChecks(
          active.session.session_id
        );
        setActiveChecks(checksResp.data.checks || []);
      } else {
        setActiveChecks([]);
      }
    } catch (err) {
      console.error('❌ Failed to load active session:', err);
    } finally {
      setLoadingActive(false);
    }

    // Load past sessions (new)
    setLoadingPast(true);
    try {
      const pastResp = await studentAPI.sessions(studentId, { limit: 20 });
      const data = pastResp.data as SessionsResponse;
      // Exclude the currently active session from "past"
      const activeId = activeSession?.session?.session_id;
      const filtered = (data.sessions || []).filter(
        (s) => s.session_id !== activeId
      );
      setPastSessions(filtered);
    } catch (err) {
      console.error('❌ Failed to load past sessions:', err);
    } finally {
      setLoadingPast(false);
    }
  }, [studentId, activeSession?.session?.session_id]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* === This session === */}
        <Text style={styles.sectionTitle}>This session</Text>

        {loadingActive && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        )}

        {!loadingActive && activeSession?.active && activeSession.session && (
          <TrackingTimeline
            checks={activeChecks}
            entryTime={activeSession.session.entry_time}
            exitTime={null}
          />
        )}

        {!loadingActive && !activeSession?.active && (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>No session in progress.</Text>
          </View>
        )}

        {/* === Past sessions === */}
        <Text style={styles.sectionTitle}>
          Past sessions{pastSessions.length > 0 ? ` (${pastSessions.length})` : ''}
        </Text>

        {loadingPast && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading past sessions…</Text>
          </View>
        )}

        {!loadingPast && pastSessions.length === 0 && (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>
              No past sessions yet. Once you check out, they'll appear here.
            </Text>
          </View>
        )}

        {!loadingPast && pastSessions.length > 0 && (
          <View style={styles.sessionList}>
            {pastSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                expanded={expandedId === s.id}
                onToggle={() =>
                  setExpandedId(expandedId === s.id ? null : s.id)
                }
              />
            ))}
          </View>
        )}

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
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: '#94a3b8' },
  emptyBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },

  // Session list
  sessionList: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  sessionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  sessionTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  anomalyNote: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 6,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default HistoryScreen;