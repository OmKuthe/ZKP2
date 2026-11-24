// app/types/navigation.ts
import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Login: undefined;
  MainTabs: { screen?: string; params?: any } | undefined;
  FaceVerify: { challengeId?: number } | undefined;
  QRScanner: { qrPayload?: any; purpose?: 'entry' | 'exit' } | undefined;
};

export type MainTabParamList = {
  Home: { faceVerified?: boolean } | undefined;
  History: undefined;
  Calendar: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

