// app/types/navigation.ts
import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: { faceVerified?: boolean } | undefined;
  History: undefined;
  Calendar: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  FaceVerify: undefined; // studentId comes from context
  QRScanner: {
    qrPayload?: any;
    purpose: 'entry' | 'exit';
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}