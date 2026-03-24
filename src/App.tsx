import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/admin/Users';
import Kelas from './pages/admin/Kelas';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

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
      <AuthProvider>
        <Router>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            
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
              
              {/* Guru Routes */}
              <Route path="guru/modul" element={
                <ProtectedRoute allowedRoles={['GURU']}>
                  <div className="p-4">Manajemen Modul (Segera Hadir)</div>
                </ProtectedRoute>
              } />
              
              {/* Siswa Routes */}
              <Route path="siswa/modul" element={
                <ProtectedRoute allowedRoles={['SISWA']}>
                  <div className="p-4">Modul Belajar (Segera Hadir)</div>
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
