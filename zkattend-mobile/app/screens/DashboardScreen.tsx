// zkattend-mobile/app/screens/DashboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  AppState,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { studentAPI } from '../api/client';
import { RootStackParamList } from '../types/navigation';
import { getCounterHash, getExitHash } from '../utils/hashChain';

// ============================================================
// Wi-Fi Fingerprinting imports (NEW)
// ============================================================
import {
  captureEnvironment,
  captureTemplate,
  ensureEnvironmentPermissions,
} from '../native/environment';
import { toAPList } from '../utils/commitment';
import { WIFI_CONFIG } from '../utils/constants';

import TrackingTimeline from '../components/TrackingTimeline';

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

type CheckInStatus =
  | 'idle'
  | 'requesting_location'
  | 'verifying_location'
  | 'requesting_qr'
  | 'qr_received'
  | 'scanning_qr'
  | 'entry_complete'
  | 'error';

type ContinuityStatus = 'idle' | 'pending' | 'verified' | 'failed';

interface VerificationLog {
  time: string;
  counter: number;
  status: 'success' | 'failed' | 'info';
  message: string;
}

interface ContinuityCheck {
  id: number;
  check_number: number;
  check_time: string;
  status: string;
  hash_link: string;
  hash_link_valid: boolean;
  message: string;
}

interface StoredChainData {
  sessionId: string;
  seed: string;
  counter: number;
  studentId: string;
}

// ==================== Storage Functions ====================

async function saveChainData(data: StoredChainData): Promise<void> {
  try {
    const key = `chain_${data.sessionId}`;
    await AsyncStorage.setItem(key, JSON.stringify(data));
    console.log(`✅ Chain saved to storage: ${key}`);
  } catch (error) {
    console.error('❌ Failed to save chain:', error);
  }
}

async function loadChainData(
  sessionId: string
): Promise<StoredChainData | null> {
  try {
    const key = `chain_${sessionId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const data = JSON.parse(stored);
      console.log(`✅ Chain loaded from storage: ${key}`);
      return data;
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to load chain:', error);
    return null;
  }
}

async function clearChainData(sessionId: string): Promise<void> {
  try {
    const key = `chain_${sessionId}`;
    await AsyncStorage.removeItem(key);
    console.log(`✅ Chain cleared from storage: ${key}`);
  } catch (error) {
    console.error('❌ Failed to clear chain:', error);
  }
}

// ==================== Main Component ====================

const DashboardScreen = () => {
  const route = useRoute();
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { studentId } = route.params as { studentId: string };

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [internship, setInternship] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [studentName, setStudentName] = useState('');

  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [qrData, setQrData] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // ==================== Hash Chain State ====================
  const [seed, setSeed] = useState<string | null>(null);
  const [counter, setCounter] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isChainGenerated, setIsChainGenerated] = useState(false);
  const [continuityStatus, setContinuityStatus] =
    useState<ContinuityStatus>('idle');
  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>(
    []
  );
  const [showLogs, setShowLogs] = useState(false);

  // ==================== Environment / Wi-Fi State ====================
  const [environmentStored, setEnvironmentStored] = useState(false);
  const [environmentVerified, setEnvironmentVerified] = useState(false);
  // ✅ NEW: Wi-Fi fingerprinting state
  const [wifiScore, setWifiScore] = useState<number | null>(null);
  const [wifiAnomaly, setWifiAnomaly] = useState<boolean>(false);
  const [wifiCheckEnabled, setWifiCheckEnabled] = useState<boolean>(false);

  // ==================== Tracking Timeline State ====================
  const [continuityChecks, setContinuityChecks] = useState<ContinuityCheck[]>(
    []
  );
  const [entryTime, setEntryTime] = useState<string | null>(null);
  const [nextCheckIn, setNextCheckIn] = useState(60);

  // ==================== Refs ====================
  const sessionIdRef = useRef<string | null>(null);
  const seedRef = useRef<string | null>(null);
  const counterRef = useRef<number>(0);
  const isChainGeneratedRef = useRef<boolean>(false);
  const isCheckingIn = useRef<boolean>(false);
  const autoCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCheckStartedRef = useRef<boolean>(false);
  const countdownStartedRef = useRef<boolean>(false);
  const wifiCheckEnabledRef = useRef<boolean>(false); // ✅ NEW

  // Update refs when state changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    counterRef.current = counter;
  }, [counter]);

  useEffect(() => {
    isChainGeneratedRef.current = isChainGenerated;
  }, [isChainGenerated]);

  // ✅ NEW: keep ref in sync with state
  useEffect(() => {
    wifiCheckEnabledRef.current = wifiCheckEnabled;
  }, [wifiCheckEnabled]);

  // ==================== Fetch Continuity Checks ====================
  const fetchContinuityChecks = async (sid: string) => {
    try {
      const response = await studentAPI.getContinuityChecks(sid);
      setContinuityChecks(response.data.checks || []);
      setEntryTime(response.data.entry_time || null);
      console.log(
        `📊 Fetched ${response.data.checks?.length || 0} continuity checks`
      );
    } catch (error) {
      console.error('Failed to fetch checks:', error);
      setContinuityChecks([]);
    }
  };

  // ==================== Load Stored Chain on App Start ====================
  useEffect(() => {
    const restoreChain = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const chainKeys = keys.filter((k) => k.startsWith('chain_'));

        for (const key of chainKeys) {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const data: StoredChainData = JSON.parse(stored);
            if (data.studentId === studentId) {
              const response = await studentAPI.getActiveSession(studentId);
              if (response.data.active) {
                setSessionId(data.sessionId);
                setSeed(data.seed);
                setCounter(data.counter || 0);
                setIsChainGenerated(true);
                console.log(
                  `✅ Restored chain for session ${data.sessionId}, counter ${data.counter}`
                );
                break;
              } else {
                await clearChainData(data.sessionId);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to restore chain:', error);
      }
    };

    restoreChain();
  }, [studentId]);

  // ✅ Fetch checks when session changes
  useEffect(() => {
    if (sessionId) {
      fetchContinuityChecks(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await studentAPI.getDashboard(studentId);
      setStudentName(response.data.student?.name || '');
      setInternship(response.data.active_internship || null);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const loadActiveSession = async () => {
    try {
      const response = await studentAPI.getActiveSession(studentId);
      if (response.data.active) {
        const newSession = response.data.session;
        if (!session || session.session_id !== newSession.session_id) {
          setSession(newSession);
        }
        if (!sessionId) {
          setSessionId(newSession.session_id);
        }
        console.log(`✅ Active session loaded: ${newSession.session_id}`);
      } else {
        if (!isCheckingIn.current && !isChainGeneratedRef.current) {
          setSession(null);
          setSessionId(null);
          setSeed(null);
          setCounter(0);
          setIsChainGenerated(false);
          setContinuityStatus('idle');
          setVerificationLogs([]);
          setEnvironmentStored(false);
          setEnvironmentVerified(false);
          // ✅ Reset Wi-Fi state
          setWifiScore(null);
          setWifiAnomaly(false);
          setWifiCheckEnabled(false);
          setContinuityChecks([]);
          setEntryTime(null);
          autoCheckStartedRef.current = false;
          countdownStartedRef.current = false;
          if (autoCheckTimerRef.current) {
            clearInterval(autoCheckTimerRef.current);
            autoCheckTimerRef.current = null;
          }
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          console.log('🔴 No active session');
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await loadDashboard();
    await loadActiveSession();
    if (sessionId) {
      await fetchContinuityChecks(sessionId);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(loadActiveSession, 30000);
    return () => clearInterval(interval);
  }, []);

  // ==================== Auto Continuity Check ====================
  useEffect(() => {
    if (autoCheckStartedRef.current) return;

    if (session && isChainGenerated && seed) {
      console.log('⏰ Starting auto-continuity checks (every 60 seconds)');

      if (autoCheckTimerRef.current) {
        clearInterval(autoCheckTimerRef.current);
        autoCheckTimerRef.current = null;
      }

      autoCheckTimerRef.current = setInterval(() => {
        console.log('⏰ Auto-check triggered at', new Date().toLocaleTimeString());
        sendContinuityCheck();
        // ✅ NEW: also run a Wi-Fi check alongside continuity
        sendWifiCheck();
      }, 60000);

      autoCheckStartedRef.current = true;
    }

    return () => {
      if (autoCheckTimerRef.current) {
        clearInterval(autoCheckTimerRef.current);
        autoCheckTimerRef.current = null;
      }
    };
  }, [session, isChainGenerated, seed]);

  // ==================== Countdown Timer ====================
  useEffect(() => {
    if (countdownStartedRef.current) return;

    if (session && isChainGenerated) {
      console.log('⏰ Starting countdown timer');

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      setNextCheckIn(60);
      countdownTimerRef.current = setInterval(() => {
        setNextCheckIn((prev) => {
          if (prev <= 1) {
            sendContinuityCheck();
            // ✅ NEW: also run a Wi-Fi check
            sendWifiCheck();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);

      countdownStartedRef.current = true;
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [session, isChainGenerated]);

  // ==================== App State Listener ====================
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App resumed from background');
        if (session && isChainGenerated && seed) {
          console.log('⏰ App resumed — checking continuity...');
          setTimeout(() => sendContinuityCheck(), 2000);
        }
      }
    });

    return () => subscription.remove();
  }, [session, isChainGenerated, seed]);

  const isWithinInternshipHours = () => {
    if (!internship) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = (internship.daily_start || '09:00')
      .split(':')
      .map(Number);
    const [endHour, endMin] = (internship.daily_end || '17:00')
      .split(':')
      .map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return currentTime >= startMinutes && currentTime <= endMinutes;
  };

  const handleLogout = () => {
    if (sessionId) {
      clearChainData(sessionId);
    }
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => navigation.replace('Login'),
      },
    ]);
  };

  // ==================== Continuity Check ====================
  const sendContinuityCheck = async () => {
    const sid = sessionIdRef.current;
    const seedVal = seedRef.current;
    const currentCounter = counterRef.current;

    if (!sid || !seedVal) {
      console.log('⚠️ No session ID or seed');
      return;
    }

    if (!isChainGeneratedRef.current) {
      console.log('⚠️ Chain not generated');
      return;
    }

    const nextCounter = currentCounter + 1;
    const hash = await getCounterHash(seedVal, nextCounter);
    console.log(`📡 Sending continuity check #${nextCounter}`);

    setContinuityStatus('pending');
    setStatusMessage(`🔄 Verifying continuity #${nextCounter}...`);

    try {
      const response = await studentAPI.verifyContinuity(sid, hash);
      console.log(
        `📡 Response: ${response.data.verified ? '✅ Verified' : '❌ Failed'}`
      );

      const logEntry: VerificationLog = {
        time: new Date().toLocaleTimeString(),
        counter: nextCounter,
        status: response.data.verified ? 'success' : 'failed',
        message: response.data.verified
          ? `✅ Check #${nextCounter} verified (counter: ${response.data.current_index})`
          : `❌ Check #${nextCounter} failed: ${response.data.message}`,
      };

      setVerificationLogs((prev) => [...prev, logEntry]);

      if (response.data.verified) {
        setCounter(nextCounter);
        counterRef.current = nextCounter;
        await saveChainData({
          sessionId: sid,
          seed: seedVal,
          counter: nextCounter,
          studentId: studentId,
        });
        setContinuityStatus('verified');
        setStatusMessage(`✅ Continuity #${nextCounter} verified!`);
        await fetchContinuityChecks(sid);
      } else {
        setContinuityStatus('failed');
        setStatusMessage(`❌ Continuity #${nextCounter} failed!`);
      }
    } catch (error) {
      console.error('❌ Continuity check error:', error);
      setContinuityStatus('failed');
      setStatusMessage('❌ Continuity check error!');

      setVerificationLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          counter: nextCounter,
          status: 'failed',
          message: '❌ Network error',
        },
      ]);
    }
  };

  // ============================================================
  // ✅ NEW: Wi-Fi Verification
  // ============================================================
  const sendWifiCheck = async () => {
    const sid = sessionIdRef.current;

    if (!sid) {
      console.log('⚠️ No session ID for Wi-Fi check');
      return;
    }

    if (!wifiCheckEnabledRef.current) {
      console.log('⚠️ Wi-Fi checks disabled');
      return;
    }

    try {
      console.log('📶 Running Wi-Fi verification...');
      const envData = await captureEnvironment();

      if (envData.aps.length === 0) {
        console.log('⚠️ No APs seen — skipping Wi-Fi check');
        return;
      }

      const aps = toAPList(envData.aps);
      const response = await studentAPI.verifyWifi(sid, aps);

      const { verified, similarity_score, is_anomaly, message, anomaly_id } =
        response.data;

      setWifiScore(similarity_score);
      setWifiAnomaly(is_anomaly);

      setVerificationLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          counter: -2, // -2 = Wi-Fi log
          status: verified ? 'success' : 'failed',
          message: verified
            ? `📶 Wi-Fi verified (score ${similarity_score.toFixed(2)})`
            : `📶 Wi-Fi anomaly (score ${similarity_score.toFixed(
                2
              )})${anomaly_id ? ` — flagged #${anomaly_id}` : ''}`,
        },
      ]);

      if (is_anomaly) {
        console.warn(`🚨 Wi-Fi anomaly detected: ${message}`);
      }
    } catch (error) {
      console.error('❌ Wi-Fi check failed:', error);
    }
  };

  // ==================== Verify First Hash (h1) ====================
  const verifyFirstHash = async (sid: string, seedVal: string) => {
    console.log(`🔐 Verifying first hash (counter: 1)...`);
    setStatusMessage('🔐 Verifying first hash...');

    const hash = await getCounterHash(seedVal, 1);

    try {
      const response = await studentAPI.verifyContinuity(sid, hash);

      if (response.data.verified) {
        console.log('✅ First hash verified successfully!');
        setCounter(1);
        counterRef.current = 1;
        await saveChainData({
          sessionId: sid,
          seed: seedVal,
          counter: 1,
          studentId: studentId,
        });
        setVerificationLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            counter: 1,
            status: 'success',
            message: '✅ First hash verified - Chain confirmed!',
          },
        ]);
        setStatusMessage('✅ First hash verified!');
        await fetchContinuityChecks(sid);
        return true;
      } else {
        console.log('❌ First hash verification failed');
        setVerificationLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            counter: 1,
            status: 'failed',
            message: '❌ First hash verification failed!',
          },
        ]);
        return false;
      }
    } catch (error) {
      console.error('❌ First hash verification error:', error);
      return false;
    }
  };

  // ==================== Check In ====================
  const handleCheckIn = async () => {
    if (!internship) {
      Alert.alert('No Internship', 'You are not assigned to any active internship.');
      return;
    }
    if (session) {
      Alert.alert('Already Checked In', 'You already have an active session.');
      return;
    }

    if (!isWithinInternshipHours()) {
      Alert.alert(
        'Outside Working Hours',
        `Internship hours are ${internship.daily_start} - ${internship.daily_end}.`
      );
      return;
    }

    isCheckingIn.current = true;
    setCheckInStatus('requesting_location');
    setStatusMessage('📍 Requesting location...');
    setLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCheckInStatus('error');
        setStatusMessage('❌ Location permission denied');
        Alert.alert('Permission Denied', 'Location permission is required.');
        setLoading(false);
        isCheckingIn.current = false;
        return;
      }

      setStatusMessage('📍 Getting your location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      console.log(
        `📍 Location: ${location.coords.latitude}, ${location.coords.longitude}`
      );

      setStatusMessage('🔍 Verifying location with ZKP...');
      setCheckInStatus('verifying_location');

      const response = await studentAPI.startEntry(
        studentId,
        location.coords.latitude,
        location.coords.longitude
      );

      const data = response.data;
      console.log(
        `📍 Start entry response: ${data.verified ? '✅ Verified' : '❌ Failed'}`
      );

      if (!data.verified) {
        setCheckInStatus('error');
        setStatusMessage(`❌ ${data.message}`);
        Alert.alert('Location Verification Failed', data.message);
        setLoading(false);
        isCheckingIn.current = false;
        return;
      }

      setStatusMessage('📱 QR generated! Verifying with server...');
      setCheckInStatus('qr_received');
      setQrData(data.qr_data);
      setShowQRModal(true);

      setTimeout(async () => {
        setStatusMessage('🔐 Completing entry...');
        setCheckInStatus('scanning_qr');

        try {
          const entryResponse = await studentAPI.completeEntry(
            studentId,
            data.qr_data.company_id,
            data.qr_data.token
          );

          const newSessionId = entryResponse.data.session_id;
          const newSeed = entryResponse.data.seed;

          if (!newSeed) {
            throw new Error('No seed received from backend');
          }

          setSessionId(newSessionId);
          sessionIdRef.current = newSessionId;
          setSeed(newSeed);
          seedRef.current = newSeed;
          setIsChainGenerated(true);
          isChainGeneratedRef.current = true;
          setContinuityStatus('idle');
          setVerificationLogs([
            {
              time: new Date().toLocaleTimeString(),
              counter: 0,
              status: 'info',
              message: '✅ Session started',
            },
          ]);

          await saveChainData({
            sessionId: newSessionId,
            seed: newSeed,
            counter: 0,
            studentId: studentId,
          });

          const firstVerified = await verifyFirstHash(newSessionId, newSeed);
          if (!firstVerified) {
            console.log('⚠️ First hash verification failed — continuing anyway');
          }

          // ============================================================
          // ✅ Wi-Fi Fingerprint Enrollment (replaces old environment)
          // ============================================================
          try {
            console.log('📶 Starting Wi-Fi fingerprint enrollment...');

            const hasPermission = await ensureEnvironmentPermissions();
            if (!hasPermission) {
              console.warn('⚠️ Wi-Fi permissions not granted');
              setVerificationLogs((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  counter: 0,
                  status: 'info',
                  message: '📶 Wi-Fi permission denied — Wi-Fi checks disabled',
                },
              ]);
              setWifiCheckEnabled(false);
            } else {
              const envData = await captureTemplate(
                WIFI_CONFIG.ENROLL_SCAN_ROUNDS,
                WIFI_CONFIG.ENROLL_SCAN_INTERVAL_MS
              );

              if (envData.is_usable) {
                const aps = toAPList(envData.aps);
                
                console.log('📶 [DEBUG] About to enroll. APs count:', aps.length);
                console.log('📶 [DEBUG] First AP:', JSON.stringify(aps[0]));
                console.log('📶 [DEBUG] Session ID:', newSessionId);
                console.log('📶 [DEBUG] API_URL:', require('../api/client').API_URL);

                let wifiResponse;
                try {
                  const payload = { session_id: newSessionId, scans: [aps] };
                  const serialized = JSON.stringify(payload);
                  console.log('📶 [DEBUG] Payload size:', serialized.length, 'bytes');
                  console.log('📶 [DEBUG] Payload preview:', serialized.substring(0, 300));

                  wifiResponse = await studentAPI.enrollWifi(
                    newSessionId,
                    [aps]
                  );
                } catch (err: any) {
                  console.error('❌ [DEBUG] Enroll failed:', err);
                  console.error('❌ [DEBUG] Error name:', err.name);
                  console.error('❌ [DEBUG] Error message:', err.message);
                  console.error('❌ [DEBUG] Error config URL:', err.config?.url);
                  console.error('❌ [DEBUG] Error config baseURL:', err.config?.baseURL);
                  console.error('❌ [DEBUG] Error config method:', err.config?.method);
                  console.error('❌ [DEBUG] Error request exists:', !!err.request);
                  throw err;
                }


                if (wifiResponse.data.success) {
                  setEnvironmentStored(true);
                  setWifiCheckEnabled(true);
                  console.log(
                    `✅ Wi-Fi template enrolled: ${wifiResponse.data.ap_count} APs, threshold=${wifiResponse.data.threshold}`
                  );
                  setVerificationLogs((prev) => [
                    ...prev,
                    {
                      time: new Date().toLocaleTimeString(),
                      counter: 0,
                      status: 'success',
                      message: `📶 Wi-Fi template: ${wifiResponse.data.ap_count} APs enrolled`,
                    },
                  ]);
                } else {
                  setWifiCheckEnabled(false);
                  setVerificationLogs((prev) => [
                    ...prev,
                    {
                      time: new Date().toLocaleTimeString(),
                      counter: 0,
                      status: 'info',
                      message: `📶 Wi-Fi enrollment skipped: ${wifiResponse.data.message}`,
                    },
                  ]);
                }
              } else {
                console.warn(
                  `⚠️ Not enough APs (${envData.aps.length}). Need at least ${WIFI_CONFIG.MIN_APS_FOR_TEMPLATE}.`
                );
                setWifiCheckEnabled(false);
                setVerificationLogs((prev) => [
                  ...prev,
                  {
                    time: new Date().toLocaleTimeString(),
                    counter: 0,
                    status: 'info',
                    message: `📶 Only ${envData.aps.length} APs — Wi-Fi checks disabled`,
                  },
                ]);
              }
            }
          } catch (error) {
            console.warn('⚠️ Wi-Fi enrollment failed (continuing anyway):', error);
            setWifiCheckEnabled(false);
            setVerificationLogs((prev) => [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                counter: 0,
                status: 'info',
                message: '📶 Wi-Fi enrollment error — checks disabled',
              },
            ]);
          }

          await fetchContinuityChecks(newSessionId);

          setCheckInStatus('entry_complete');
          setStatusMessage('✅ Check-in successful!');
          setShowQRModal(false);

          Alert.alert(
            '✅ Check In Successful',
            'Entry verified with ZKP! Hash chain + Wi-Fi started.'
          );

          setTimeout(async () => {
            await loadActiveSession();
            isCheckingIn.current = false;
          }, 10000);
        } catch (error: any) {
          console.error('❌ Entry error:', error);
          setCheckInStatus('error');
          setStatusMessage(`❌ ${error.message}`);
          Alert.alert('Check-in Failed', error.response?.data?.detail || error.message);
          isCheckingIn.current = false;
        }
      }, 3000);
    } catch (error: any) {
      console.error('❌ Check-in error:', error);
      setCheckInStatus('error');
      setStatusMessage(`❌ ${error.message}`);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check in.');
      isCheckingIn.current = false;
    } finally {
      setLoading(false);
    }
  };

  // ==================== Check Out ====================
  const handleCheckOut = async () => {
    if (!session) {
      Alert.alert('No Active Session', 'You are not checked in.');
      return;
    }

    setCheckInStatus('requesting_location');
    setStatusMessage('📍 Requesting location for exit...');
    setLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let latitude = 0;
      let longitude = 0;

      if (status === 'granted') {
        setStatusMessage('📍 Getting your location...');
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }

      setStatusMessage('🔍 Verifying location for exit...');
      const response = await studentAPI.startExit(studentId, latitude, longitude);
      const data = response.data;

      if (!data.verified && data.qr_data === null) {
        setCheckInStatus('error');
        setStatusMessage(`❌ ${data.message}`);
        Alert.alert('Exit Failed', data.message);
        setLoading(false);
        return;
      }

      setStatusMessage('📱 Exit QR generated!');
      setCheckInStatus('qr_received');
      setQrData(data.qr_data);
      setShowQRModal(true);

      setTimeout(async () => {
        setStatusMessage('📷 Scanning exit QR...');
        setCheckInStatus('scanning_qr');

        try {
          const seedVal = seedRef.current;
          let finalHash = null;

          if (seedVal) {
            finalHash = await getExitHash(seedVal);
          }

          // ✅ Optional: run a final Wi-Fi check at exit
          let envMatch = false;
          try {
            if (wifiCheckEnabledRef.current) {
              console.log('📶 Running final Wi-Fi check on exit...');
              const envData = await captureEnvironment();
              if (envData.aps.length > 0) {
                const aps = toAPList(envData.aps);
                const wifiExitResp = await studentAPI.verifyWifi(
                  sessionId!,
                  aps
                );
                envMatch = wifiExitResp.data.verified;
                setWifiScore(wifiExitResp.data.similarity_score);
                setWifiAnomaly(wifiExitResp.data.is_anomaly);
                setVerificationLogs((prev) => [
                  ...prev,
                  {
                    time: new Date().toLocaleTimeString(),
                    counter: -2,
                    status: envMatch ? 'success' : 'info',
                    message: `📶 Exit Wi-Fi: ${envMatch ? '✅ Verified' : '⚠️ Not verified (allowed)'}`,
                  },
                ]);
              }
            }
          } catch (error) {
            console.warn('⚠️ Exit Wi-Fi check failed (continuing):', error);
          }

          const exitResponse = await studentAPI.completeExit(
            studentId,
            data.qr_data.company_id,
            data.qr_data.token,
            finalHash || undefined
          );

          setCheckInStatus('entry_complete');
          setStatusMessage('✅ Check-out successful!');
          setShowQRModal(false);

          if (exitResponse.data.chain_verified && envMatch) {
            Alert.alert(
              '✅ Check Out Successful',
              `Duration: ${exitResponse.data.duration_minutes} minutes\n✅ Hash chain verified!\n✅ Wi-Fi verified!`
            );
          } else if (exitResponse.data.chain_verified) {
            Alert.alert(
              '✅ Check Out Successful',
              `Duration: ${exitResponse.data.duration_minutes} minutes\n✅ Hash chain verified!`
            );
          } else {
            Alert.alert(
              '⚠️ Check Out Completed',
              `Duration: ${exitResponse.data.duration_minutes} minutes\n⚠️ Hash chain could not be verified.`
            );
          }

          if (sessionId) {
            await clearChainData(sessionId);
          }

          setSeed(null);
          setCounter(0);
          setIsChainGenerated(false);
          setContinuityStatus('idle');
          setEnvironmentStored(false);
          setEnvironmentVerified(false);
          // ✅ Reset Wi-Fi state
          setWifiScore(null);
          setWifiAnomaly(false);
          setWifiCheckEnabled(false);
          setContinuityChecks([]);
          setEntryTime(null);

          await refreshAll();
        } catch (error: any) {
          console.error('❌ Exit error:', error);
          setCheckInStatus('error');
          setStatusMessage(
            `❌ ${error.response?.data?.detail || 'Failed to complete exit'}`
          );
          Alert.alert(
            'Check-out Failed',
            error.response?.data?.detail || 'Failed to complete exit'
          );
        }
      }, 3000);
    } catch (error: any) {
      console.error('❌ Check-out error:', error);
      setCheckInStatus('error');
      setStatusMessage(`❌ ${error.message}`);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check out.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualContinuityCheck = () => {
    if (!session) {
      Alert.alert('No Active Session', 'You are not checked in.');
      return;
    }
    if (!isChainGenerated || !seed) {
      Alert.alert('No Hash Chain', 'Hash chain not generated yet.');
      return;
    }
    sendContinuityCheck();
    // ✅ NEW: also fire a Wi-Fi check
    sendWifiCheck();
  };

  const getStatusText = () => {
    if (session) return '✅ Checked In';
    if (internship?.can_start) return '🔵 Ready to Check In';
    return internship?.status_message || 'No Active Internship';
  };

  const getContinuityDisplay = () => {
    if (!session) return null;
    if (!isChainGenerated) return '⏳ Generating...';
    if (continuityStatus === 'pending') return '🔄 Verifying...';
    if (continuityStatus === 'verified') return '✅ Verified';
    if (continuityStatus === 'failed') return '⚠️ Anomaly Detected';
    return `🔗 Counter: ${counter}`;
  };

  const getContinuityColor = () => {
    if (!session) return '#94a3b8';
    if (!isChainGenerated) return '#f59e0b';
    if (continuityStatus === 'pending') return '#f59e0b';
    if (continuityStatus === 'verified') return '#16A34A';
    if (continuityStatus === 'failed') return '#DC2626';
    return '#4F46E5';
  };

  const isWithinHours = isWithinInternshipHours();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>ZKAttend</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>{studentName || studentId}</Text>

        {session && (
          <View style={styles.continuityRow}>
            <View
              style={[styles.continuityDot, { backgroundColor: getContinuityColor() }]}
            />
            <Text style={styles.continuityText}>{getContinuityDisplay()}</Text>
            <TouchableOpacity
              onPress={() => setShowLogs(!showLogs)}
              style={styles.logsToggle}
            >
              <Text style={styles.logsToggleText}>
                {showLogs ? 'Hide Logs' : `${verificationLogs.length} Logs`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ✅ Wi-Fi status line */}
        {session && environmentStored && (
          <Text style={styles.envStatus}>
            📶 Wi-Fi:{' '}
            {wifiAnomaly
              ? `🚨 Anomaly (score ${wifiScore?.toFixed(2) ?? '?'})`
              : wifiScore !== null
              ? `✅ Verified (${wifiScore.toFixed(2)})`
              : '📡 Captured'}
          </Text>
        )}

        {session && isChainGenerated && (
          <Text style={styles.autoStatus}>
            ⏰ Next check in: {nextCheckIn}s | Counter: {counter}/100
          </Text>
        )}
      </View>

      {showLogs && verificationLogs.length > 0 && (
        <View style={styles.logsContainer}>
          <Text style={styles.logsTitle}>Verification History</Text>
          {verificationLogs.map((log, index) => (
            <View key={index} style={styles.logItem}>
              <Text style={styles.logTime}>{log.time}</Text>
              <Text style={styles.logCounter}>#{log.counter}</Text>
              <Text
                style={[
                  styles.logStatus,
                  log.status === 'success'
                    ? styles.logSuccess
                    : log.status === 'info'
                    ? styles.logInfo
                    : styles.logFailed,
                ]}
              >
                {log.status === 'success' ? '✅' : log.status === 'info' ? 'ℹ️' : '❌'}
              </Text>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Status</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: session ? '#16A34A' : '#4F46E5' },
            ]}
          />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {checkInStatus !== 'idle' && (
          <View style={styles.statusProgress}>
            <Text style={styles.statusProgressText}>{statusMessage}</Text>
            {checkInStatus !== 'error' && checkInStatus !== 'entry_complete' && (
              <ActivityIndicator
                size="small"
                color="#4F46E5"
                style={styles.statusSpinner}
              />
            )}
            {checkInStatus === 'error' && <Text style={styles.statusError}>❌</Text>}
            {checkInStatus === 'entry_complete' && (
              <Text style={styles.statusSuccess}>✅</Text>
            )}
          </View>
        )}

        {internship && (
          <View style={styles.internshipInfo}>
            <Text style={styles.companyName}>{internship.company_name}</Text>
            <Text style={styles.roleName}>{internship.role_name}</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Timings:</Text>
              <Text style={styles.detailsValue}>
                {internship.daily_start} - {internship.daily_end}
              </Text>
            </View>
            {!isWithinHours && !session && (
              <Text style={styles.warningText}>
                ⏰ Outside working hours. Check-in available {internship.daily_start} -{' '}
                {internship.daily_end}
              </Text>
            )}
            {internship.is_paid && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Stipend:</Text>
                <Text style={styles.detailsValue}>
                  ₹{internship.stipend_amount}/month
                </Text>
              </View>
            )}
            {session && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Duration:</Text>
                <Text style={styles.detailsValue}>
                  {session.duration_minutes} minutes
                </Text>
              </View>
            )}
          </View>
        )}

        {!internship && (
          <Text style={styles.noInternship}>
            No active internship found. Please contact your coordinator.
          </Text>
        )}
      </View>

      {session && (
        <TrackingTimeline
          checks={continuityChecks}
          entryTime={entryTime}
          exitTime={session?.exit_time}
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.checkInButton,
            (!internship?.can_start || session || !isWithinHours || loading) &&
              styles.buttonDisabled,
          ]}
          onPress={handleCheckIn}
          disabled={!internship?.can_start || !!session || !isWithinHours || loading}
        >
          <Text style={styles.buttonText}>Check In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.checkOutButton,
            (!session || loading) && styles.buttonDisabled,
          ]}
          onPress={handleCheckOut}
          disabled={!session || loading}
        >
          <Text style={styles.buttonText}>Check Out</Text>
        </TouchableOpacity>

        {session && isChainGenerated && (
          <TouchableOpacity
            style={[styles.button, styles.continuityButton]}
            onPress={handleManualContinuityCheck}
            disabled={loading || !isChainGenerated}
          >
            <Text style={styles.buttonText}>🔄 Verify Now</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.footer}>
        {session && isChainGenerated
          ? `🔗 Counter: ${counter}/100 | Next check: ${nextCheckIn}s`
          : internship?.is_paid
          ? '💰 Paid Internship'
          : '📋 Internship Active'}
      </Text>

      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {qrData?.purpose === 'entry' ? '📱 Entry QR Code' : '📱 Exit QR Code'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {checkInStatus === 'qr_received'
                ? 'QR generated! Verifying...'
                : 'Processing...'}
            </Text>

            <View style={styles.qrContainer}>
              {qrData && (
                <QRCode
                  value={JSON.stringify({
                    token: qrData.token,
                    student_id: qrData.student_id,
                    company_id: qrData.company_id,
                    timestamp: qrData.timestamp,
                    expires_at: qrData.expires_at,
                    purpose: qrData.purpose,
                  })}
                  size={200}
                  color="#1a1a2e"
                  backgroundColor="white"
                />
              )}
            </View>

            <Text style={styles.qrTokenText}>
              Token: {qrData?.token?.substring(0, 16)}...
            </Text>

            <ActivityIndicator
              size="large"
              color="#4F46E5"
              style={styles.modalSpinner}
            />
            <Text style={styles.modalStatus}>{statusMessage}</Text>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowQRModal(false);
                setCheckInStatus('idle');
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: {
    backgroundColor: '#4F46E5',
    padding: 20,
    paddingTop: 48,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#c7d2fe', marginTop: 4 },
  continuityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  continuityDot: { width: 10, height: 10, borderRadius: 5 },
  continuityText: {
    color: '#c7d2fe',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  envStatus: { color: '#a5b4fc', fontSize: 12, marginTop: 2 },
  autoStatus: { color: '#a5b4fc', fontSize: 11, marginTop: 2, opacity: 0.8 },
  logsToggle: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  logsToggleText: { color: '#c7d2fe', fontSize: 11 },
  logsContainer: {
    backgroundColor: '#1e1b4b',
    margin: 12,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
  },
  logsTitle: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logTime: { color: '#94a3b8', fontSize: 9, width: 60 },
  logCounter: { color: '#94a3b8', fontSize: 9, width: 35, textAlign: 'center' },
  logStatus: { fontSize: 11, width: 20, textAlign: 'center' },
  logSuccess: { color: '#16A34A' },
  logInfo: { color: '#60A5FA' },
  logFailed: { color: '#DC2626' },
  logMessage: { color: '#e2e8f0', fontSize: 10, flex: 1 },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  statusProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statusProgressText: { flex: 1, fontSize: 13, color: '#333' },
  statusSpinner: { marginLeft: 8 },
  statusError: { fontSize: 18, marginLeft: 8 },
  statusSuccess: { fontSize: 18, marginLeft: 8 },
  internshipInfo: { marginTop: 12 },
  companyName: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e' },
  roleName: { fontSize: 14, color: '#666', marginTop: 2, marginBottom: 8 },
  detailsRow: { flexDirection: 'row', marginTop: 4 },
  detailsLabel: { fontSize: 14, color: '#666', width: 100 },
  detailsValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  warningText: { fontSize: 12, color: '#F59E0B', marginTop: 8, fontWeight: '500' },
  noInternship: { color: '#999', textAlign: 'center', paddingVertical: 16 },
  actions: { paddingHorizontal: 16, gap: 12 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center' },
  checkInButton: { backgroundColor: '#4F46E5' },
  checkOutButton: { backgroundColor: '#DC2626' },
  continuityButton: { backgroundColor: '#8B5CF6' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  footer: { textAlign: 'center', color: '#666', fontSize: 11, padding: 16 },

  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4F46E5',
    marginBottom: 12,
  },
  qrTokenText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  modalSpinner: { marginTop: 8 },
  modalStatus: { fontSize: 14, color: '#666', marginTop: 8 },
  modalCancelButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  modalCancelText: { fontSize: 14, color: '#666', fontWeight: '500' },
});

export default DashboardScreen;