// app/types/navigation.ts
export type RootStackParamList = {
  Login: undefined;
  Dashboard: { studentId: string; faceVerified?: boolean };
  QRScanner: {
    studentId: string;
    qrPayload?: any;
    purpose: 'entry' | 'exit';
  };
  FaceVerify: { studentId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}