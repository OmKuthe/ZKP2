import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/Auth/ProtectedRoute'

// Auth Components
import Login from './components/Auth/Login'

// Student Components
import StudentDashboard from './components/Student/StudentDashboard'
import StudentAttendance from './components/Student/StudentAttendance'
import StudentHistory from './components/Student/StudentHistory'

// Manager Components
import ManagerDashboard from './components/Manager/ManagerDashboard'
import InternshipDetails from './components/Manager/InternshipDetails'
import StudentTimeline from './components/Manager/StudentTimeline'
import StudentCalendar from './components/Manager/StudentCalender'

// Admin Components
import AdminDashboard from './components/Admin/AdminDashboard'
import StudentManagement from './components/Admin/StudentManagement'
import ManagerManagement from './components/Admin/ManagerManagement'
import CompanyManagement from './components/Admin/CompanyManagement'
import InternshipManagement from './components/Admin/InternshipManagement'
import HolidayManagement from './components/Admin/HolidayManagement'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" />} />
          
          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute role="student"><StudentAttendance /></ProtectedRoute>} />
          <Route path="/student/history" element={<ProtectedRoute role="student"><StudentHistory /></ProtectedRoute>} />
          
          {/* Manager Routes */}
          <Route path="/manager" element={<ProtectedRoute role="manager"><ManagerDashboard /></ProtectedRoute>} />
          <Route path="/manager/internship/:id" element={<ProtectedRoute role="manager"><InternshipDetails /></ProtectedRoute>} />
          <Route path="/manager/student/:studentId/timeline" element={<ProtectedRoute role="manager"><StudentTimeline /></ProtectedRoute>} />
          <Route path="/manager/student/:studentId/calendar" element={<ProtectedRoute allowedRoles={['manager']}><StudentCalendar /></ProtectedRoute>}/>
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute role="admin"><StudentManagement /></ProtectedRoute>} />
          <Route path="/admin/managers" element={<ProtectedRoute role="admin"><ManagerManagement /></ProtectedRoute>} />
          <Route path="/admin/companies" element={<ProtectedRoute role="admin"><CompanyManagement /></ProtectedRoute>} />
          <Route path="/admin/internships" element={<ProtectedRoute role="admin"><InternshipManagement /></ProtectedRoute>} />
          <Route path="/admin/holidays" element={<ProtectedRoute role="admin"><HolidayManagement /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App