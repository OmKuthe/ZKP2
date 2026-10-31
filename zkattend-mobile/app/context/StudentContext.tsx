// zkattend-mobile/app/context/StudentContext.tsx
/**
 * Global student identity context.
 *
 * Replaces route-param propagation of `studentId` across the navigator
 * hierarchy. Screens read it via `useStudent()` or `useRequiredStudentId()`.
 *
 * Combined with conditional rendering in App.tsx (tabs only mount when
 * studentId is non-null), this eliminates the "route.params.studentId is
 * undefined inside tabs" bug class entirely.
 */
import React, { createContext, useContext, useState, useMemo } from 'react';

interface StudentContextValue {
  studentId: string | null;
  setStudentId: (id: string | null) => void;
}

const StudentContext = createContext<StudentContextValue | undefined>(
  undefined
);

interface StudentProviderProps {
  children: React.ReactNode;
}

export const StudentProvider: React.FC<StudentProviderProps> = ({
  children,
}) => {
  const [studentId, setStudentId] = useState<string | null>(null);

  // Stable reference so consumers don't re-render on unrelated tree updates
  const value = useMemo<StudentContextValue>(
    () => ({ studentId, setStudentId }),
    [studentId]
  );

  return (
    <StudentContext.Provider value={value}>
      {children}
    </StudentContext.Provider>
  );
};

/**
 * Access the raw context value.
 * Returns `studentId: null` after logout / before login.
 */
export function useStudent(): StudentContextValue {
  const ctx = useContext(StudentContext);
  if (!ctx) {
    throw new Error(
      'useStudent() must be called inside a <StudentProvider>. ' +
        'Wrap your app root in <StudentProvider>.'
    );
  }
  return ctx;
}

/**
 * Convenience hook for screens that require a logged-in student.
 * Throws early if the screen is rendered without one, so bugs surface
 * at the mount boundary rather than as silent `undefined` API calls.
 */
export function useRequiredStudentId(): string {
  const { studentId } = useStudent();
  if (!studentId) {
    throw new Error(
      'Screen mounted without studentId. ' +
        'This screen should only render inside the authenticated part of the app.'
    );
  }
  return studentId;
}