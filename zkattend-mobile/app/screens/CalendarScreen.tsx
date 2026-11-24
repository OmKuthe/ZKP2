// zkattend-mobile/app/screens/CalendarScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';

import { studentAPI } from '../api/client';
import { useRequiredStudentId } from '../context/StudentContext';

interface CalendarDay {
  day: string; // YYYY-MM-DD
  present: boolean;
  session_count: number;
  verified_count: number;
  flagged_count: number;
}

interface CalendarResponse {
  student_id: string;
  month: string; // YYYY-MM
  timezone: string;
  days: CalendarDay[];
}

interface SessionItem {
  id: number;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  status: string;
  overall_verified: boolean | null;
}

// ---------- helpers ----------

const pad2 = (n: number): string => String(n).padStart(2, '0');

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const monthLabel = (date: Date): string =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const todayKey = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
};

const addMonths = (date: Date, delta: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
};

// ---------- main ----------

const CalendarScreen = () => {
  const studentId = useRequiredStudentId();

  const [anchor, setAnchor] = useState<Date>(new Date());
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [daySessions, setDaySessions] = useState<SessionItem[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await studentAPI.calendar(studentId, monthKey(anchor));
      setData(resp.data as CalendarResponse);
    } catch (err: any) {
      console.error('❌ Calendar load failed:', err);
      setError(
        err?.response?.data?.detail ||
          'Could not load calendar. Pull to refresh.'
      );
    } finally {
      setLoading(false);
    }
  }, [studentId, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDayPress = async (dayKey: string) => {
    setSelectedDay(dayKey);
    setLoadingDay(true);
    try {
      const resp = await studentAPI.sessions(studentId, {
        from: dayKey,
        to: dayKey,
      });
      const sessions = (resp.data.sessions || []) as SessionItem[];
      setDaySessions(sessions);
    } catch (err) {
      console.error('❌ Day sessions load failed:', err);
      setDaySessions([]);
    } finally {
      setLoadingDay(false);
    }
  };

  // Build the calendar grid
  const renderGrid = () => {
    if (!data) return null;

    const [yearStr, monStr] = data.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monStr, 10) - 1;

    const firstDay = new Date(year, month, 1);
    // JS: 0=Sun, 1=Mon, ..., 6=Sat. We want Mon-first grid.
    const firstWeekday = (firstDay.getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<CalendarDay | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (const d of data.days) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    // Group into weeks
    const weeks: Array<Array<CalendarDay | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const today = todayKey();

    return (
      <View>
        {/* Weekday headers */}
        <View style={styles.weekHeader}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
            <Text key={i} style={styles.weekHeaderText}>
              {w}
            </Text>
          ))}
        </View>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((cell, di) => {
              if (!cell) {
                return <View key={di} style={styles.dayCellPlaceholder} />;
              }

              const isToday = cell.day === today;
              const dayNum = parseInt(cell.day.slice(-2), 10);

              let dotColor = '#CBD5E1'; // grey default
              if (cell.present) {
                dotColor = cell.flagged_count > 0 ? '#F59E0B' : '#16A34A';
              }

              return (
                <TouchableOpacity
                  key={di}
                  style={styles.dayCell}
                  onPress={() => handleDayPress(cell.day)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && styles.dayCircleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && styles.dayNumToday,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </View>
                  <View
                    style={[styles.dayDot, { backgroundColor: dotColor }]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // Month summary
  const renderSummary = () => {
    if (!data) return null;

    const totalSessions = data.days.reduce(
      (sum, d) => sum + d.session_count,
      0
    );
    const presentDays = data.days.filter((d) => d.present).length;
    const verifiedSessions = data.days.reduce(
      (sum, d) => sum + d.verified_count,
      0
    );
    const flaggedSessions = data.days.reduce(
      (sum, d) => sum + d.flagged_count,
      0
    );
    const daysInMonth = data.days.length;

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Month summary</Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryValue}>
              {presentDays}/{daysInMonth}
            </Text>
            <Text style={styles.summaryLabel}>days present</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryValue}>{totalSessions}</Text>
            <Text style={styles.summaryLabel}>sessions</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
              {verifiedSessions}
            </Text>
            <Text style={styles.summaryLabel}>verified</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text
              style={[
                styles.summaryValue,
                { color: flaggedSessions > 0 ? '#DC2626' : '#94a3b8' },
              ]}
            >
              {flaggedSessions}
            </Text>
            <Text style={styles.summaryLabel}>flagged</Text>
          </View>
        </View>
      </View>
    );
  };

  // Day detail modal
  const renderDayModal = () => {
    if (!selectedDay) return null;

    return (
      <Modal
        transparent
        visible={!!selectedDay}
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedDay(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString(
                undefined,
                {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }
              )}
            </Text>

            {loadingDay && (
              <ActivityIndicator
                size="small"
                color="#4F46E5"
                style={{ marginVertical: 20 }}
              />
            )}

            {!loadingDay && daySessions.length === 0 && (
              <Text style={styles.modalEmpty}>
                No sessions on this day.
              </Text>
            )}

            {!loadingDay &&
              daySessions.map((s) => (
                <View key={s.id} style={styles.modalSession}>
                  <View style={styles.modalSessionRow}>
                    <Text style={styles.modalSessionTime}>
                      {new Date(s.started_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' → '}
                      {s.ended_at
                        ? new Date(s.ended_at).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '…'}
                    </Text>
                    <View
                      style={[
                        styles.modalStatusPill,
                        {
                          backgroundColor:
                            s.status === 'closed'
                              ? '#16A34A'
                              : s.status === 'flagged'
                              ? '#DC2626'
                              : '#F59E0B',
                        },
                      ]}
                    >
                      <Text style={styles.modalStatusText}>{s.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalSessionMeta}>
                    {s.duration_minutes} min ·{' '}
                    {s.overall_verified === true
                      ? '✓ fully verified'
                      : s.overall_verified === false
                      ? '✗ not fully verified'
                      : '— pending'}
                  </Text>
                </View>
              ))}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedDay(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
      </View>

      {/* Month navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setAnchor(addMonths(anchor, -1))}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(anchor)}</Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setAnchor(addMonths(anchor, 1))}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading calendar…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        )}

        {!loading && data && (
          <>
            <View style={styles.gridCard}>{renderGrid()}</View>
            {renderSummary()}

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.legendText}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendText}>Flagged</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#CBD5E1' }]} />
                <Text style={styles.legendText}>Absent</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {renderDayModal()}
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  navButtonText: {
    fontSize: 24,
    color: '#4F46E5',
    fontWeight: '600',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  body: { flex: 1 },
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
    marginTop: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },

  // Grid
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 4,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCellPlaceholder: {
    flex: 1,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleToday: {
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dayNumToday: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },

  // Summary
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
    marginHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  modalEmpty: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalSession: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  modalSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalSessionTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    fontVariant: ['tabular-nums'],
  },
  modalSessionMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  modalStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  modalStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  modalClose: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
});

export default CalendarScreen;