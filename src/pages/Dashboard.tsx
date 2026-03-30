import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Users, CheckCircle, Clock, Activity } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function Dashboard() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.role === 'GURU') {
      // Fetch recent activities
      // Note: If you want to filter by kelas_id, you can add: where('kelas_id', '==', profile.kelas_id)
      // But for now we'll fetch all activities or limit to recent ones.
      // If filtering by kelas_id and ordering by created_at, a composite index is required in Firebase.
      const q = query(
        collection(db, 'activity_logs'),
        orderBy('created_at', 'desc'),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setActivities(logs);
      }, (error) => {
        console.error("Error fetching activities:", error);
      });

      return () => unsubscribe();
    }
  }, [profile]);

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Selamat Datang, {profile.nama_lengkap}!
        </h1>
      </div>

      {profile.role === 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pengguna</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Kelola</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Kelas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Kelola</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {profile.role === 'GURU' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Modul Aktif</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">Kelola</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tugas Menunggu</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">Penilaian</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Log Aktivitas Siswa (Real-time)</h2>
              </div>
            </div>
            <div className="p-0">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  Belum ada aktivitas siswa terbaru.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {activities.map((log) => (
                    <li key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                            {log.nama_siswa?.charAt(0).toUpperCase() || 'S'}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {log.nama_siswa}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {log.aksi}
                          </p>
                          {log.modul_judul && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                              Modul: {log.modul_judul}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {log.created_at ? formatDistanceToNow(log.created_at.toDate(), { addSuffix: true, locale: idLocale }) : 'Baru saja'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {profile.role === 'SISWA' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Modul Belajar</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Lihat</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Progres</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Lihat</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
