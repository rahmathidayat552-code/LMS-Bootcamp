import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from './admin/AdminDashboard';
import GuruDashboard from './guru/GuruDashboard';
import SiswaDashboard from './siswa/SiswaDashboard';

export default function Dashboard() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Selamat Datang, {profile.nama_lengkap}!
        </h1>
      </div>

      {profile.role === 'ADMIN' && <AdminDashboard />}
      {profile.role === 'GURU' && <GuruDashboard />}
      {profile.role === 'SISWA' && <SiswaDashboard />}
    </div>
  );
}
