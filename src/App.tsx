import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Users from './pages/admin/Users';
import Kelas from './pages/admin/Kelas';
import ManajemenSiswa from './pages/admin/ManajemenSiswa';
import ManajemenGuru from './pages/admin/ManajemenGuru';
import ManajemenKursus from './pages/admin/ManajemenKursus';
import ModulList from './pages/guru/Modul';
import ModulForm from './pages/guru/ModulForm';
import ModulMonitoring from './pages/guru/ModulMonitoring';
import ModulKursus from './pages/guru/ModulKursus';
import Penilaian from './pages/guru/Penilaian';
import PenilaianSiswa from './pages/guru/PenilaianSiswa';
import PenilaianDetail from './pages/guru/PenilaianDetail';
import PenilaianBobot from './pages/guru/PenilaianBobot';
import ModulSiswaList from './pages/siswa/ModulList';
import ModulSiswaDetail from './pages/siswa/ModulDetail';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

import ForgotPassword from './pages/ForgotPassword';

import { SettingsProvider } from './contexts/SettingsContext';
import { NotificationProvider } from './contexts/NotificationContext';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <NotificationProvider>
              <Toaster position="top-right" richColors />
              <Router>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              
              {/* Admin Routes */}
              <Route path="admin/users" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="admin/kelas" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Kelas />
                </ProtectedRoute>
              } />
              <Route path="admin/guru" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ManajemenGuru />
                </ProtectedRoute>
              } />
              <Route path="admin/siswa" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ManajemenSiswa />
                </ProtectedRoute>
              } />
              <Route path="admin/kursus" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ManajemenKursus />
                </ProtectedRoute>
              } />
              
              {/* Guru Routes */}
              <Route path="guru/modul" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <ModulList />
                </ProtectedRoute>
              } />
              <Route path="guru/modul/create" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <ModulForm />
                </ProtectedRoute>
              } />
              <Route path="guru/modul/:id" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <ModulForm />
                </ProtectedRoute>
              } />
              <Route path="guru/modul/:id/monitoring" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <ModulMonitoring />
                </ProtectedRoute>
              } />
              <Route path="guru/kursus" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <ModulKursus />
                </ProtectedRoute>
              } />
              <Route path="guru/penilaian" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <Penilaian />
                </ProtectedRoute>
              } />
              <Route path="guru/penilaian/:modulId" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <PenilaianSiswa />
                </ProtectedRoute>
              } />
              <Route path="guru/penilaian/:modulId/:siswaId" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <PenilaianDetail />
                </ProtectedRoute>
              } />
              <Route path="guru/penilaian/:modulId/bobot" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <PenilaianBobot />
                </ProtectedRoute>
              } />
              
              {/* Siswa Routes */}
              <Route path="siswa/modul" element={
                <ProtectedRoute allowedRoles={['SISWA']}>
                  <ModulSiswaList />
                </ProtectedRoute>
              } />
              <Route path="siswa/modul/:id" element={
                <ProtectedRoute allowedRoles={['SISWA', 'GURU', 'ADMIN']}>
                  <ModulSiswaDetail />
                </ProtectedRoute>
              } />

              {/* Shared Routes */}
              <Route path="profil" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'GURU', 'SISWA']}>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="notifikasi" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'GURU', 'SISWA']}>
                  <Notifications />
                </ProtectedRoute>
              } />
              <Route path="pengaturan" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'GURU', 'SISWA']}>
                  <Settings />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </Router>
        </NotificationProvider>
        </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
