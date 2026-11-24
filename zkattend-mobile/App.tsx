// App.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './app/screens/LoginScreen';
import FaceVerifyScreen from './app/screens/FaceVerifyScreen';
import QRScannerScreen from './app/screens/QRScannerScreen';
import MainTabs from './app/navigation/MainTabs';
import ChallengeModal, { PendingChallenge } from './app/components/ChallengeModal';
import { StudentProvider, useStudent } from './app/context/StudentContext';
import { RootStackParamList } from './app/types/navigation';
import { challengeBus } from './app/utils/challengeBus';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { studentId } = useStudent();
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);

  // Subscribe to pending challenges emitted by verificationLoop
  useEffect(() => {
    const unsubscribe = challengeBus.subscribe((info) => {
      setChallenge({
        challengeId: info.challengeId,
        sessionId: info.sessionId,
        issuedAt: info.issuedAt,
        expiresAt: info.expiresAt,
        reason: info.reason,
      });
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {studentId ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="FaceVerify" component={FaceVerifyScreen} />
            <Stack.Screen name="QRScanner" component={QRScannerScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>

      {/* Global challenge modal overlays everything */}
      <ChallengeModal
        challenge={challenge}
        onDismiss={() => setChallenge(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <StudentProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </StudentProvider>
  );
}