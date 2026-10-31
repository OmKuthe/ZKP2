// zkattend-mobile/app/screens/DashboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  AppState,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { studentAPI } from '../api/client';
import { RootStackParamList, MainTabParamList } from '../types/navigation';
import { getExitHash } from '../utils/hashChain';

import {
  captureEnvironment,
  captureTemplate,
  ensureEnvironmentPermissions,
} from '../native/environment';
import { toAPList } from '../utils/commitment';
import { WIFI_CONFIG } from '../utils/constants';

import {
  startLoop,
  restoreLoop,
  runCycleOnce,
  setWifiEnabled,
  type ContinuityResult,
  type WifiResult,
} from '../services/verificationLoop';
import {
  startForegroundVerification,
  stopEverything,
  isForegroundServiceRunning,
} from '../services/ForegroundService';

import { useRequiredStudentId, useStudent } from '../context/StudentContext';

import HeaderBar, {
  HeaderStatus,
} from '../components/dashboard/HeaderBar';
import PrimaryActionCard from '../components/dashboard/PrimaryActionCard';
import VerificationStrip, {
  FaceLayerState,
  WifiLayerState,
  ChainLayerState,
} from '../components/dashboard/VerificationStrip';
import TodaySummary from '../components/dashboard/TodaySummary';
import RecentActivity, {
  VerificationLog,
} from '../components/dashboard/RecentActivity';
import LayerDetailModal, {
  VerificationLayer,
} from '../components/dashboard/LayerDetailModal';

// Composite: DashboardScreen lives inside BottomTab, but can also push
// onto the root stack (FaceVerify). This type reflects both.
type DashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
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

async function clearChainData(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`chain_${sessionId}`);
    console.log(`✅ Chain cleared: chain_${sessionId}`);
  } catch (error) {
    console.error('❌ Failed to clear chain:', error);
  }
}

const DashboardScreen = ({ navigation, route }: DashboardScreenProps) => {
  const studentId = useRequiredStudentId();
  const { setStudentId: setContextStudentId } = useStudent();

  const faceVerified = (route.params as { faceVerified?: boolean } | undefined)
    ?.faceVerified;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [internship, setInternship] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [studentName, setStudentName] = useState('');

  const [statusMessage, setStatusMessage] = useState('');
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('idle');
  const [qrData, setQrData] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const [seed, setSeed] = useState<string | null>(null);
  const [counter, setCounter] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isChainGenerated, setIsChainGenerated] = useState(false);
  const [continuityStatus, setContinuityStatus] =
    useState<ContinuityStatus>('idle');
  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>(
    []
  );

  const [wifiScore, setWifiScore] = useState<number | null>(null);
  const [wifiAnomaly, setWifiAnomaly] = useState<boolean>(false);
  const [wifiCheckEnabled, setWifiCheckEnabled] = useState<boolean>(false);

  const [sessionFaceVerified, setSessionFaceVerified] = useState<
    boolean | null
  >(null);

  const [continuityChecks, setContinuityChecks] = useState<ContinuityCheck[]>(
    []
  );
  const [entryTime, setEntryTime] = useState<string | null>(null);
  const [nextCheckIn, setNextCheckIn] = useState(60);

  const [detailLayer, setDetailLayer] = useState<VerificationLayer | null>(
    null
  );
  const [recentExpanded, setRecentExpanded] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const seedRef = useRef<string | null>(null);
  const studentIdRef = useRef<string>(studentId);
  const isCheckingIn = useRef<boolean>(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceVerifiedRef = useRef<boolean | null>(null);
  const pendingCheckInRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);
  useEffect(() => {
    studentIdRef.current = studentId;
  }, [studentId]);

  // Handle return from FaceVerifyScreen
  useEffect(() => {
    if (typeof faceVerified === 'boolean') {
      console.log(`🧠 Face verification returned: ${faceVerified}`);
      faceVerifiedRef.current = faceVerified;
      setSessionFaceVerified(faceVerified);
      if (pendingCheckInRef.current) {
        pendingCheckInRef.current = false;
        navigation.setParams({ faceVerified: undefined } as any);
        proceedWithCheckIn();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceVerified]);

  const fetchContinuityChecks = async (sid: string) => {
    try {
      const response = await studentAPI.getContinuityChecks(sid);
      if (!isMountedRef.current) return;
      setContinuityChecks(response.data.checks || []);
      setEntryTime(response.data.entry_time || null);
      console.log(
        `📊 Fetched ${response.data.checks?.length || 0} continuity checks`
      );
    } catch (error) {
      console.error('Failed to fetch checks:', error);
      if (isMountedRef.current) setContinuityChecks([]);
    }
  };

  useEffect(() => {
    const restore = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const chainKeys = keys.filter((k) => k.startsWith('chain_'));
        for (const key of chainKeys) {
          const stored = await AsyncStorage.getItem(key);
          if (!stored) continue;
          const data: StoredChainData = JSON.parse(stored);
          if (data.studentId !== studentId) continue;

          const response = await studentAPI.getActiveSession(studentId);
          if (response.data.active) {
            setSessionId(data.sessionId);
            sessionIdRef.current = data.sessionId;
            setSeed(data.seed);
            seedRef.current = data.seed;
            setCounter(data.counter || 0);
            setIsChainGenerated(true);
            setSession(response.data.session);

            restoreLoop(
              {
                sessionId: data.sessionId,
                seed: data.seed,
                studentId,
              },
              data.counter || 0,
              buildLoopListeners()
            );
            setWifiEnabled(true);

            if (!isForegroundServiceRunning()) {
              startForegroundVerification({
                onQuotaWarning: handleQuotaWarning,
                onServiceStopped: handleServiceStopped,
              }).catch((err) =>
                console.error('❌ Failed to start service:', err)
              );
            }
            break;
          } else {
            await clearChainData(data.sessionId);
          }
        }
      } catch (error) {
        console.error('❌ Failed to restore chain:', error);
      }
    };

    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (sessionId) fetchContinuityChecks(sessionId);
  }, [sessionId]);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await studentAPI.getDashboard(studentId);
      if (!isMountedRef.current) return;
      setStudentName(response.data.student?.name || '');
      setInternship(response.data.active_internship || null);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const loadActiveSession = async () => {
    try {
      const response = await studentAPI.getActiveSession(studentId);
      if (!isMountedRef.current) return;
      if (response.data.active) {
        const newSession = response.data.session;
        setSession(newSession);
        if (!sessionId) {
          setSessionId(newSession.session_id);
          sessionIdRef.current = newSession.session_id;
        }
      } else {
        if (!isCheckingIn.current && !isChainGenerated) {
          setSession(null);
          setSessionId(null);
          sessionIdRef.current = null;
          setSeed(null);
          seedRef.current = null;
          setCounter(0);
          setIsChainGenerated(false);
          setContinuityStatus('idle');
          setVerificationLogs([]);
          setWifiScore(null);
          setWifiAnomaly(false);
          setWifiCheckEnabled(false);
          setSessionFaceVerified(null);
          setContinuityChecks([]);
          setEntryTime(null);
          stopEverything('manual').catch((err) =>
            console.error('❌ stopEverything failed:', err)
          );
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
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
    if (sessionId) await fetchContinuityChecks(sessionId);
    if (isMountedRef.current) setRefreshing(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(loadActiveSession, 90000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleContinuityResult(result: ContinuityResult): void {
    if (!isMountedRef.current) return;
    setContinuityStatus(result.verified ? 'verified' : 'failed');
    setVerificationLogs((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        counter: result.counter,
        status: result.verified ? 'success' : 'failed',
        message: result.message,
      },
    ]);
    if (result.verified) {
      setCounter(result.counter);
      setNextCheckIn(60);
      if (sessionIdRef.current) fetchContinuityChecks(sessionIdRef.current);
    }
  }

  function handleWifiResult(result: WifiResult): void {
    if (!isMountedRef.current) return;
    if (!result.attempted) return;
    if (result.error || result.score === 0) return;
    setWifiScore(result.score);
    setWifiAnomaly(result.anomaly);
    setVerificationLogs((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        counter: -2,
        status: result.verified ? 'success' : 'failed',
        message: result.message,
      },
    ]);
  }

  function handleQuotaWarning(): void {
    console.warn('⚠️ Quota warning — degrading (not yet wired)');
    if (!isMountedRef.current) return;
    setVerificationLogs((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        counter: -3,
        status: 'info',
        message:
          '⏳ Android 15 quota reached — verification paused. Contact admin if unexpected.',
      },
    ]);
  }

  function handleServiceStopped(
    reason: 'manual' | 'quota' | 'loop_stopped'
  ): void {
    console.log(`🔔 Foreground service stopped (${reason})`);
  }

  function buildLoopListeners() {
    return {
      onContinuityResult: handleContinuityResult,
      onWifiResult: handleWifiResult,
    };
  }

  useEffect(() => {
    if (!session || !isChainGenerated) return;
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setNextCheckIn(60);
    countdownTimerRef.current = setInterval(() => {
      if (isMountedRef.current) {
        setNextCheckIn((prev) => (prev <= 1 ? 60 : prev - 1));
      }
    }, 1000);
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [session, isChainGenerated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        if (session && isChainGenerated && seed) {
          runCycleOnce('resume').catch((err) =>
            console.error('❌ Resume cycle failed:', err)
          );
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
    return (
      currentTime >= startHour * 60 + startMin &&
      currentTime <= endHour * 60 + endMin
    );
  };

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
            console.error('❌ stopEverything during logout failed:', err);
          }
          if (sessionIdRef.current) {
            await clearChainData(sessionIdRef.current);
          }
          // ✅ Setting null triggers conditional render → Login
          setContextStudentId(null);
        },
      },
    ]);
  };

  const runManualCycle = async () => {
    if (!session) {
      Alert.alert('No Active Session', 'You are not checked in.');
      return;
    }
    if (!isChainGenerated || !seed) {
      Alert.alert('No Hash Chain', 'Hash chain not generated yet.');
      return;
    }
    setContinuityStatus('pending');
    setStatusMessage('🔄 Running manual verification...');
    setNextCheckIn(60);
    try {
      await runCycleOnce('manual');
    } catch (err) {
      console.error('❌ Manual cycle failed:', err);
    }
  };

  const verifyFirstHash = async (
    sid: string,
    seedVal: string
  ): Promise<boolean> => {
    setStatusMessage('🔐 Verifying first hash...');
    try {
      startLoop(
        { sessionId: sid, seed: seedVal, studentId: studentIdRef.current },
        buildLoopListeners()
      );
      const result = await runCycleOnce('manual');
      if (result.continuity.verified) {
        setStatusMessage('✅ First hash verified!');
        await fetchContinuityChecks(sid);
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ First hash verification error:', err);
      return false;
    }
  };

  const handleCheckIn = async () => {
    if (!internship) {
      Alert.alert(
        'No Internship',
        'You are not assigned to any active internship.'
      );
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

    if (faceVerifiedRef.current === null) {
      pendingCheckInRef.current = true;
      isCheckingIn.current = true;
      try {
        navigation.navigate('FaceVerify');
      } catch (err) {
        console.error('❌ FaceVerify nav failed:', err);
        isCheckingIn.current = false;
        pendingCheckInRef.current = false;
      }
      return;
    }

    proceedWithCheckIn();
  };

  const proceedWithCheckIn = async () => {
    if (isCheckingIn.current === false) {
      isCheckingIn.current = true;
    }
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
        faceVerifiedRef.current = null;
        setSessionFaceVerified(null);
        return;
      }

      setStatusMessage('📍 Getting your location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setStatusMessage('🔍 Verifying location with ZKP...');
      setCheckInStatus('verifying_location');

      const response = await studentAPI.startEntry(
        studentId,
        location.coords.latitude,
        location.coords.longitude
      );

      const data = response.data;
      if (!data.verified) {
        setCheckInStatus('error');
        setStatusMessage(`❌ ${data.message}`);
        Alert.alert('Location Verification Failed', data.message);
        setLoading(false);
        isCheckingIn.current = false;
        faceVerifiedRef.current = null;
        setSessionFaceVerified(null);
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
            data.qr_data.token,
            faceVerifiedRef.current
          );

          const newSessionId = entryResponse.data.session_id;
          const newSeed = entryResponse.data.seed;
          if (!newSeed) throw new Error('No seed received from backend');

          setSessionId(newSessionId);
          sessionIdRef.current = newSessionId;
          setSeed(newSeed);
          seedRef.current = newSeed;
          setIsChainGenerated(true);
          setContinuityStatus('idle');
          setSessionFaceVerified(faceVerifiedRef.current);
          setEntryTime(new Date().toISOString());
          setVerificationLogs([
            {
              time: new Date().toLocaleTimeString(),
              counter: 0,
              status: 'info',
              message: `✅ Session started (face: ${
                faceVerifiedRef.current === true
                  ? 'verified'
                  : faceVerifiedRef.current === false
                  ? 'failed'
                  : 'skipped'
              })`,
            },
          ]);

          try {
            const activeResp = await studentAPI.getActiveSession(studentId);
            if (activeResp.data.active) {
              setSession(activeResp.data.session);
            }
          } catch {}

          let finalWifiEnabled = false;
          try {
            const hasPermission = await ensureEnvironmentPermissions();
            if (!hasPermission) {
              finalWifiEnabled = false;
            } else {
              const envData = await captureTemplate(
                WIFI_CONFIG.ENROLL_SCAN_ROUNDS,
                WIFI_CONFIG.ENROLL_SCAN_INTERVAL_MS
              );
              if (envData.is_usable) {
                const aps = toAPList(envData.aps);
                const wifiResponse = await studentAPI.enrollWifi(newSessionId, [
                  aps,
                ]);
                if (wifiResponse.data.success) {
                  finalWifiEnabled = true;
                  setVerificationLogs((prev) => [
                    ...prev,
                    {
                      time: new Date().toLocaleTimeString(),
                      counter: 0,
                      status: 'success',
                      message: `📶 Wi-Fi template: ${wifiResponse.data.ap_count} APs enrolled`,
                    },
                  ]);
                }
              }
            }
          } catch (error) {
            console.warn('⚠️ Wi-Fi enrollment failed:', error);
            finalWifiEnabled = false;
          }

          setWifiCheckEnabled(finalWifiEnabled);
          setWifiEnabled(finalWifiEnabled);

          await fetchContinuityChecks(newSessionId);
          setCheckInStatus('entry_complete');
          setStatusMessage('✅ Check-in successful!');
          setShowQRModal(false);

          if (isMountedRef.current) {
            Alert.alert(
              '✅ Check In Successful',
              'Entry verified with ZKP! Hash chain + Wi-Fi started.'
            );
          }

          isCheckingIn.current = false;
          faceVerifiedRef.current = null;

          const firstVerified = await verifyFirstHash(
            newSessionId,
            newSeed
          );
          if (!firstVerified) {
            console.log('⚠️ First hash verification failed');
          }

          if (!isForegroundServiceRunning()) {
            await startForegroundVerification({
              onQuotaWarning: handleQuotaWarning,
              onServiceStopped: handleServiceStopped,
            });
          }
        } catch (error: any) {
          console.error('❌ Entry error:', error);
          setCheckInStatus('error');
          setStatusMessage(`❌ ${error.message}`);
          setShowQRModal(false);
          if (isMountedRef.current) {
            Alert.alert(
              'Check-in Failed',
              error.response?.data?.detail || error.message
            );
          }
          isCheckingIn.current = false;
          faceVerifiedRef.current = null;
        }
      }, 3000);
    } catch (error: any) {
      console.error('❌ Check-in error:', error);
      setCheckInStatus('error');
      setStatusMessage(`❌ ${error.message}`);
      if (isMountedRef.current) {
        Alert.alert(
          'Error',
          error.response?.data?.detail || 'Failed to check in.'
        );
      }
      isCheckingIn.current = false;
      faceVerifiedRef.current = null;
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

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
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }

      const response = await studentAPI.startExit(
        studentId,
        latitude,
        longitude
      );
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
          await stopEverything('manual');

          const seedVal = seedRef.current;
          let finalHash = null;
          if (seedVal) finalHash = await getExitHash(seedVal);

          let envMatch = false;
          try {
            if (wifiCheckEnabled && sessionIdRef.current) {
              const envData = await captureEnvironment();
              if (envData.aps.length > 0) {
                const aps = toAPList(envData.aps);
                const wifiExitResp = await studentAPI.verifyWifi(
                  sessionIdRef.current,
                  aps
                );
                envMatch = wifiExitResp.data.verified;
                setWifiScore(wifiExitResp.data.similarity_score);
                setWifiAnomaly(wifiExitResp.data.is_anomaly);
              }
            }
          } catch (error) {
            console.warn('⚠️ Exit Wi-Fi check failed:', error);
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

          if (isMountedRef.current) {
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
          }

          if (sessionIdRef.current) {
            await clearChainData(sessionIdRef.current);
          }

          setSession(null);
          setSeed(null);
          seedRef.current = null;
          setCounter(0);
          setIsChainGenerated(false);
          setContinuityStatus('idle');
          setWifiScore(null);
          setWifiAnomaly(false);
          setWifiCheckEnabled(false);
          setSessionFaceVerified(null);
          setContinuityChecks([]);
          setEntryTime(null);
          faceVerifiedRef.current = null;

          await refreshAll();
        } catch (error: any) {
          console.error('❌ Exit error:', error);
          setCheckInStatus('error');
          setStatusMessage(
            `❌ ${error.response?.data?.detail || 'Failed to complete exit'}`
          );
          setShowQRModal(false);
          if (isMountedRef.current) {
            Alert.alert(
              'Check-out Failed',
              error.response?.data?.detail || 'Failed to complete exit'
            );
          }
        }
      }, 3000);
    } catch (error: any) {
      console.error('❌ Check-out error:', error);
      setCheckInStatus('error');
      setStatusMessage(`❌ ${error.message}`);
      if (isMountedRef.current) {
        Alert.alert(
          'Error',
          error.response?.data?.detail || 'Failed to check out.'
        );
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const isWithinHours = isWithinInternshipHours();

  const headerStatus: HeaderStatus = (() => {
    if (!session) return 'not_active';
    if (!isChainGenerated) return 'verifying';
    if (continuityStatus === 'pending') return 'verifying';
    if (continuityStatus === 'verified') return 'verified';
    if (continuityStatus === 'failed') return 'anomaly';
    return 'not_active';
  })();

  const faceLayerState: FaceLayerState = (() => {
    if (sessionFaceVerified === true) return 'verified';
    if (sessionFaceVerified === false) return 'failed';
    return 'not_run';
  })();

  const wifiLayerState: WifiLayerState = (() => {
    if (!wifiCheckEnabled) return 'inactive';
    if (wifiAnomaly) return 'warning';
    return 'verified';
  })();

  const chainLayerState: ChainLayerState = (() => {
    if (continuityStatus === 'verified') return 'verified';
    if (continuityStatus === 'failed') return 'failed';
    return 'not_run';
  })();

  const anomalyCount = continuityChecks.filter(
    (c) => c.status === 'failed'
  ).length;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} />
        }
      >
        <HeaderBar
          studentName={studentName}
          studentId={studentId}
          status={headerStatus}
          onLogout={handleLogout}
        />

        <PrimaryActionCard
          hasSession={!!session}
          internship={
            internship
              ? {
                  company_name: internship.company_name,
                  role_name: internship.role_name,
                  daily_start: internship.daily_start,
                  daily_end: internship.daily_end,
                }
              : null
          }
          isWithinHours={isWithinHours}
          durationMinutes={session?.duration_minutes ?? null}
          counter={counter}
          nextCheckIn={nextCheckIn}
          loading={loading}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onVerifyNow={runManualCycle}
        />

        {session && (
          <VerificationStrip
            faceState={faceLayerState}
            wifiState={wifiLayerState}
            chainState={chainLayerState}
            onLayerPress={(layer) => setDetailLayer(layer)}
          />
        )}

        {session && (
          <TodaySummary
            entryTime={entryTime}
            durationMinutes={session.duration_minutes ?? null}
            anomalyCount={anomalyCount}
          />
        )}

        <RecentActivity
          logs={verificationLogs}
          expanded={recentExpanded}
          onToggle={() => setRecentExpanded(!recentExpanded)}
        />

        <View style={{ height: 40 }} />

        <LayerDetailModal
          visible={detailLayer !== null}
          layer={detailLayer}
          onClose={() => setDetailLayer(null)}
          faceVerified={sessionFaceVerified}
          faceVerifiedAt={session?.face_verified_at ?? null}
          wifiScore={wifiScore}
          wifiAnomaly={wifiAnomaly}
          wifiCheckEnabled={wifiCheckEnabled}
          continuityChecks={continuityChecks}
        />
      </ScrollView>

      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {qrData?.purpose === 'entry'
                ? '📱 Entry QR Code'
                : '📱 Exit QR Code'}
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
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
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
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