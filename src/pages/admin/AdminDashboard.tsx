import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, BookOpen, CheckCircle, Activity, Download, Database, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [activities, setActivities] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [adminStats, setAdminStats] = useState({
    totalSiswa: 0,
    totalGuru: 0,
    totalModul: 0,
    persentaseSelesai: 0,
  });

  const handleExportDatabase = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mengekspor seluruh database? Proses ini mungkin memakan waktu beberapa saat.')) {
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Menyiapkan ekspor database...');

    try {
      const collections = [
        'users',
        'master_users',
        'kelas',
        'moduls',
        'modul_items',
        'kuis_soal',
        'progres_siswa',
        'activity_logs'
      ];

      const fullData: any = {};

      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        fullData[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      const jsonString = JSON.stringify(fullData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `lms_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Database berhasil diekspor!', { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Gagal mengekspor database.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    let unsubscribes: (() => void)[] = [];
    let usersData: any[] = [];
    let modulsData: any[] = [];
    let progresData: any[] = [];

    const calculateAdminStats = () => {
      let siswaCount = 0;
      let guruCount = 0;
      usersData.forEach(user => {
        if (user.role === 'SISWA') siswaCount++;
        if (user.role === 'GURU') guruCount++;
      });

      const totalModul = modulsData.length;

      let totalProgres = 0;
      let selesaiProgres = 0;
      progresData.forEach(prog => {
        totalProgres++;
        if (prog.status_selesai) selesaiProgres++;
      });
      const persentaseSelesai = totalProgres > 0 ? Math.round((selesaiProgres / totalProgres) * 100) : 0;

      setAdminStats({
        totalSiswa: siswaCount,
        totalGuru: guruCount,
        totalModul,
        persentaseSelesai
      });
      setLoadingStats(false);
    };

    unsubscribes.push(onSnapshot(collection(db, 'users'), (snap) => {
      usersData = snap.docs.map(doc => doc.data());
      calculateAdminStats();
    }));
    unsubscribes.push(onSnapshot(collection(db, 'moduls'), (snap) => {
      modulsData = snap.docs.map(doc => doc.data());
      calculateAdminStats();
    }));
    unsubscribes.push(onSnapshot(collection(db, 'progres_siswa'), (snap) => {
      progresData = snap.docs.map(doc => doc.data());
      calculateAdminStats();
    }));

    const q = query(collection(db, 'activity_logs'), orderBy('created_at', 'desc'), limit(20));
    unsubscribes.push(onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }));

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Siswa Terdaftar</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : adminStats.totalSiswa}
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
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Guru Terdaftar</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : adminStats.totalGuru}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Modul</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : adminStats.totalModul}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Penyelesaian Modul</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : `${adminStats.persentaseSelesai}%`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Aktivitas Terbaru</h2>
          </div>
          <button
            onClick={handleExportDatabase}
            disabled={isExporting}
            className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700 dark:text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Mengekspor...
              </span>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Backup Database
              </>
            )}
          </button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <div key={activity.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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
  );
}
