// app/types/navigation.ts
export type RootStackParamList = {
  Login: undefined;
  Dashboard: { studentId: string };
  QRScanner: {
    studentId: string;
    qrPayload?: any;
    purpose: 'entry' | 'exit';
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}