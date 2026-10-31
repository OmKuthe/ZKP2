// zkattend-mobile/app/screens/ProfileScreen.tsx
/**
 * Profile screen — reached from the hamburger menu on Dashboard.
 *
 * Shows student identity + internship details (moved off the home screen
 * to declutter the primary action surface) and a working Logout button.
 *
 * Data source: GET /student/dashboard (already exists, no backend change).
 *
 * Reads `studentId` from context (useRequiredStudentId), per the
 * StudentContext migration (file #7 of 9). Logout signals the context
 * (setStudentId(null)), which triggers App.tsx's conditional render to
 * swap MainTabs -> Login — no manual navigation reset needed.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { studentAPI } from '../api/client';
import { useRequiredStudentId, useStudent } from '../context/StudentContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { stopEverything } from '../services/ForegroundService';

interface StudentInfo {
  student_id: string;
  name: string;
  email: string;
}

interface InternshipInfo {
  internship_id: number;
  company_name: string;
  role_name: string;
  daily_start: string;
  daily_end: string;
  is_paid: boolean;
  stipend_amount: number | null;
  status_message: string;
}

interface ProfileData {
  student: StudentInfo | null;
  internship: InternshipInfo | null;
}

const ProfileScreen = () => {
  const studentId = useRequiredStudentId();
  const { setStudentId: setContextStudentId } = useStudent();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfileData>({
    student: null,
    internship: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await studentAPI.getDashboard(studentId);
        const raw = response.data;

        setData({
          student: {
            student_id: raw.student?.student_id || studentId,
            name: raw.student?.name || '',
            email: raw.student?.email || '',
          },
          internship: raw.active_internship
            ? {
                internship_id: raw.active_internship.internship_id,
                company_name: raw.active_internship.company_name,
                role_name: raw.active_internship.role_name,
                daily_start: raw.active_internship.daily_start,
                daily_end: raw.active_internship.daily_end,
                is_paid: raw.active_internship.is_paid,
                stipend_amount:
                  raw.active_internship.stipend_amount ?? null,
                status_message:
                  raw.active_internship.status_message || '',
              }
            : null,
        });
      } catch (err) {
        console.error('❌ Failed to load profile:', err);
        Alert.alert(
          'Error',
          'Could not load profile. Check your connection.',
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentId]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopEverything('manual');
          } catch (err) {
            console.error(
              '❌ stopEverything during logout failed:',
              err,
            );
          }

          // Clear any chain_* keys scoped to this student.
          try {
            const keys = await AsyncStorage.getAllKeys();
            const chainKeys = keys.filter((k) =>
              k.startsWith('chain_'),
            );

            for (const key of chainKeys) {
              const stored = await AsyncStorage.getItem(key);

              if (stored) {
                const parsed = JSON.parse(stored);

                if (parsed.studentId === studentId) {
                  await AsyncStorage.removeItem(key);
                }
              }
            }
          } catch (err) {
            console.error(
              '❌ Chain cleanup during logout failed:',
              err,
            );
          }

          // ✅ Signal the context — App.tsx swaps MainTabs → Login.
          setContextStudentId(null);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <LoadingSpinner message="Loading profile…" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.body}>
        {/* Student section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Student</Text>

          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(data.student?.name || studentId || '?')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View style={styles.avatarInfo}>
              <Text style={styles.studentName}>
                {data.student?.name || '—'}
              </Text>

              <Text style={styles.studentId}>{studentId}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>

            <Text style={styles.rowValue} numberOfLines={1}>
              {data.student?.email || '—'}
            </Text>
          </View>
        </View>

        {/* Internship section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Internship</Text>

          {data.internship ? (
            <>
              <Text style={styles.companyName}>
                {data.internship.company_name}
              </Text>

              <Text style={styles.roleName}>
                {data.internship.role_name}
              </Text>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Working hours</Text>

                <Text style={styles.rowValue}>
                  {data.internship.daily_start} –{' '}
                  {data.internship.daily_end}
                </Text>
              </View>

              {data.internship.is_paid &&
                data.internship.stipend_amount && (
                  <>
                    <View style={styles.divider} />

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Stipend</Text>

                      <Text style={styles.rowValue}>
                        ₹{data.internship.stipend_amount}/month
                      </Text>
                    </View>
                  </>
                )}

              {data.internship.status_message && (
                <Text style={styles.statusMessage}>
                  {data.internship.status_message}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>
              No active internship. Contact your coordinator.
            </Text>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  header: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  body: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  avatarInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  studentId: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: '#666',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    maxWidth: '65%',
    textAlign: 'right',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  roleName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusMessage: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;