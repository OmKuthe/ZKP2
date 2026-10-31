// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './app/screens/LoginScreen';
import FaceVerifyScreen from './app/screens/FaceVerifyScreen';
import QRScannerScreen from './app/screens/QRScannerScreen';
import MainTabs from './app/navigation/MainTabs';
import { StudentProvider, useStudent } from './app/context/StudentContext';
import { RootStackParamList } from './app/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigator.
 *
 * Conditional rendering based on `studentId`:
 *   - logged out → only Login is reachable
 *   - logged in  → MainTabs + full-screen camera screens
 *
 * This is the documented React Navigation pattern for auth flows:
 * https://reactnavigation.org/docs/auth-flow#navigate-when-user-is-authenticated
 */
function RootNavigator() {
  const { studentId } = useStudent();

  return (
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