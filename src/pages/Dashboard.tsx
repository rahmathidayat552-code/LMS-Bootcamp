import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Users, CheckCircle, Clock, Activity, Download, Database, BarChart2 } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

  // Admin Stats
  const [adminStats, setAdminStats] = useState({
    totalSiswa: 0,
    totalGuru: 0,
    totalModul: 0,
    persentaseSelesai: 0,
  });

  // Guru Stats
  const [guruStats, setGuruStats] = useState({
    totalModulDibuat: 0,
    totalModulSelesai: 0,
    totalSiswaMengikuti: 0,
    progressRateData: [] as any[],
  });

  // Siswa Stats
  const [siswaStats, setSiswaStats] = useState({
    totalModul: 0,
    modulTerselesaikan: 0,
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

      // Create JSON blob
      const jsonString = JSON.stringify(fullData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
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
    if (!profile) return;

    let unsubscribes: (() => void)[] = [];

    const setupRealtimeStats = () => {
      setLoadingStats(true);

      if (profile.role === 'ADMIN') {
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

      } else if (profile.role === 'GURU') {
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

      } else if (profile.role === 'SISWA') {
        let modulsData: any[] = [];
        let itemsData: any[] = [];
        let progresData: any[] = [];

        const calculateSiswaStats = () => {
          let targetedModuls = 0;
          const modulIds: string[] = [];
          
          modulsData.forEach(data => {
            const isPublished = data.is_published === true || String(data.is_published) === 'true';
            if (!isPublished) return;

            const targetKelasIds = Array.isArray(data.target_kelas_ids) ? data.target_kelas_ids : [];
            const targetSiswaIds = Array.isArray(data.target_siswa_ids) ? data.target_siswa_ids : [];
            
            let isMatch = false;
            if (data.tipe_target === 'KELAS') {
              isMatch = targetKelasIds.includes(profile.kelas_id);
            } else if (data.tipe_target === 'SISWA') {
              isMatch = targetSiswaIds.includes(profile.uid);
            } else {
              isMatch = targetKelasIds.includes(profile.kelas_id) || targetSiswaIds.includes(profile.uid);
            }

            if (isMatch) {
              targetedModuls++;
              modulIds.push(data.id);
            }
          });

          let modulTerselesaikan = 0;
          if (modulIds.length > 0) {
            const itemsPerModul: Record<string, number> = {};
            itemsData.forEach(data => {
              if (modulIds.includes(data.modul_id)) {
                itemsPerModul[data.modul_id] = (itemsPerModul[data.modul_id] || 0) + 1;
              }
            });

            const progresByModul: Record<string, number> = {};
            progresData.forEach(data => {
              if (data.siswa_id === profile.uid && modulIds.includes(data.modul_id) && data.status_selesai) {
                progresByModul[data.modul_id] = (progresByModul[data.modul_id] || 0) + 1;
              }
            });

            modulIds.forEach(modulId => {
              const totalItems = itemsPerModul[modulId] || 0;
              const completedItems = progresByModul[modulId] || 0;
              if (totalItems > 0 && completedItems >= totalItems) {
                modulTerselesaikan++;
              }
            });
          }

          const persentaseSelesai = targetedModuls > 0 ? Math.round((modulTerselesaikan / targetedModuls) * 100) : 0;

          setSiswaStats({
            totalModul: targetedModuls,
            modulTerselesaikan,
            persentaseSelesai
          });
          setLoadingStats(false);
        };

        unsubscribes.push(onSnapshot(collection(db, 'moduls'), (snap) => {
          modulsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          calculateSiswaStats();
        }));
        unsubscribes.push(onSnapshot(collection(db, 'modul_items'), (snap) => {
          itemsData = snap.docs.map(doc => doc.data());
          calculateSiswaStats();
        }));
        const progresQ = query(collection(db, 'progres_siswa'), where('siswa_id', '==', profile.uid));
        unsubscribes.push(onSnapshot(progresQ, (snap) => {
          progresData = snap.docs.map(doc => doc.data());
          calculateSiswaStats();
        }));

        const q = query(collection(db, 'activity_logs'), where('user_id', '==', profile.uid), orderBy('created_at', 'desc'), limit(10));
        unsubscribes.push(onSnapshot(q, (snapshot) => {
          setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }));
      }
    };

    setupRealtimeStats();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
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
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Log Aktivitas Real-time</h2>
              </div>
            </div>
            <div className="p-0">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  Belum ada aktivitas terbaru.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
                  {activities.map((log) => (
                    <li key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                            {log.nama_siswa?.charAt(0).toUpperCase() || 'U'}
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

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                  <Database className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Backup Database</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ekspor seluruh data aplikasi ke dalam format JSON.</p>
                </div>
              </div>
              <button
                onClick={handleExportDatabase}
                disabled={isExporting}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Mengekspor...' : 'Ekspor JSON'}</span>
              </button>
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
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Modul Dibuat</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loadingStats ? '...' : guruStats.totalModulDibuat}
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
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Penyelesaian 100%</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loadingStats ? '...' : guruStats.totalModulSelesai}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Siswa Mengikuti</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loadingStats ? '...' : guruStats.totalSiswaMengikuti}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-6">
              <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Rata-rata Progres per Modul</h2>
            </div>
            <div className="h-72 w-full">
              {loadingStats ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500">Memuat grafik...</div>
              ) : guruStats.progressRateData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500">Belum ada data progres.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={guruStats.progressRateData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip 
                      cursor={{ fill: '#F3F4F6', opacity: 0.4 }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="progress" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Progres (%)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
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
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Modul</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loadingStats ? '...' : siswaStats.totalModul}
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
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Modul Selesai</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loadingStats ? '...' : siswaStats.modulTerselesaikan}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Persentase Selesai</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loadingStats ? '...' : `${siswaStats.persentaseSelesai}%`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
