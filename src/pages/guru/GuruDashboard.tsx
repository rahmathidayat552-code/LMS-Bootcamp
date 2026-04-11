import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { BookOpen, Users, CheckCircle, Activity, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';

export default function GuruDashboard() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [guruStats, setGuruStats] = useState({
    totalModulDibuat: 0,
    totalModulSelesai: 0,
    totalSiswaMengikuti: 0,
    progressRateData: [] as any[],
  });

  useEffect(() => {
    if (!profile) return;

    let unsubscribes: (() => void)[] = [];
    let modulsData: any[] = [];
    let itemsData: any[] = [];
    let progresData: any[] = [];

    const calculateGuruStats = () => {
      const totalModulDibuat = modulsData.length;
      const modulIds = modulsData.map(m => m.id);
      let totalModulSelesai = 0;
      const uniqueSiswa = new Set<string>();
      const progressRateData: any[] = [];

      if (modulIds.length > 0) {
        const itemsPerModul: Record<string, number> = {};
        itemsData.forEach(item => {
          if (modulIds.includes(item.modul_id)) {
            itemsPerModul[item.modul_id] = (itemsPerModul[item.modul_id] || 0) + 1;
          }
        });

        const progresByModulSiswa: Record<string, Record<string, number>> = {};
        progresData.forEach(prog => {
          if (modulIds.includes(prog.modul_id)) {
            uniqueSiswa.add(prog.siswa_id);
            if (prog.status_selesai) {
              if (!progresByModulSiswa[prog.modul_id]) progresByModulSiswa[prog.modul_id] = {};
              progresByModulSiswa[prog.modul_id][prog.siswa_id] = (progresByModulSiswa[prog.modul_id][prog.siswa_id] || 0) + 1;
            }
          }
        });

        modulsData.forEach(modul => {
          const totalItems = itemsPerModul[modul.id] || 0;
          const siswaProgress = progresByModulSiswa[modul.id] || {};
          let completedStudents = 0;
          let totalProgressPercentage = 0;
          let studentsStarted = Object.keys(siswaProgress).length;

          Object.values(siswaProgress).forEach(completedItems => {
            if (totalItems > 0 && completedItems >= totalItems) {
              completedStudents++;
              totalModulSelesai++;
            }
            if (totalItems > 0) {
              totalProgressPercentage += (completedItems / totalItems) * 100;
            }
          });

          const avgProgress = studentsStarted > 0 ? Math.round(totalProgressPercentage / studentsStarted) : 0;
          progressRateData.push({
            name: modul.judul_modul.substring(0, 15) + '...',
            progress: avgProgress
          });
        });
      }

      setGuruStats({
        totalModulDibuat,
        totalModulSelesai,
        totalSiswaMengikuti: uniqueSiswa.size,
        progressRateData
      });
      setLoadingStats(false);
    };

    const modulsQ = query(collection(db, 'moduls'), where('guru_id', '==', profile.uid));
    unsubscribes.push(onSnapshot(modulsQ, (snap) => {
      modulsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      calculateGuruStats();
    }));
    unsubscribes.push(onSnapshot(collection(db, 'modul_items'), (snap) => {
      itemsData = snap.docs.map(doc => doc.data());
      calculateGuruStats();
    }));
    unsubscribes.push(onSnapshot(collection(db, 'progres_siswa'), (snap) => {
      progresData = snap.docs.map(doc => doc.data());
      calculateGuruStats();
    }));

    const q = query(collection(db, 'activity_logs'), orderBy('created_at', 'desc'), limit(15));
    unsubscribes.push(onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const modulIds = modulsData.map(m => m.id);
      const guruLogs = logs.filter(log => modulIds.includes((log as any).modul_id));
      setActivities(guruLogs);
    }));

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [profile]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Modul Dibuat</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : guruStats.totalModulDibuat}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Siswa Mengikuti</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : guruStats.totalSiswaMengikuti}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Penyelesaian Modul</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : guruStats.totalModulSelesai}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rata-rata Progres per Modul</h2>
          </div>
          <div className="p-6 h-80">
            {loadingStats ? (
              <div className="h-full flex items-center justify-center text-gray-500">Memuat grafik...</div>
            ) : guruStats.progressRateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={guruStats.progressRateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="progress" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Progres (%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">Belum ada data progres</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Aktivitas Siswa Terbaru</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.nama_siswa}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {activity.aksi} {activity.modul_judul ? `pada modul "${activity.modul_judul}"` : ''}
                      </p>
                    </div>
                    <div className="flex items-center text-xs text-gray-400 dark:text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {activity.created_at ? formatDistanceToNow(activity.created_at.toDate(), { addSuffix: true, locale: idLocale }) : 'Baru saja'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                Belum ada aktivitas tercatat.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
