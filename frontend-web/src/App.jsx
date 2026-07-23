// frontend-web/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ManagerLogin from './pages/ManagerLogin';
import ManagerLayout from './components/ManagerLayout';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerInternshipDetail from './pages/ManagerInternshipDetail';
import ManagerCreateInternship from './pages/ManagerCreateInternship';
import ManagerStudents from './pages/ManagerStudents';

function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/manager/login" element={<ManagerLogin />} />
        
        <Route path="/manager" element={
          token ? <ManagerLayout /> : <Navigate to="/manager/login" replace />
        }>
          <Route index element={<ManagerDashboard />} />
          <Route path="students" element={<ManagerStudents />} />
          <Route path="internships/:id" element={<ManagerInternshipDetail />} />
          <Route path="internships/create" element={<ManagerCreateInternship />} />
        </Route>
        
        <Route path="/" element={<Navigate to="/manager" replace />} />
        <Route path="*" element={<Navigate to="/manager/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;