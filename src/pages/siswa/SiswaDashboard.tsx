import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { BookOpen, CheckCircle, Activity, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';

export default function SiswaDashboard() {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [siswaStats, setSiswaStats] = useState({
    totalModul: 0,
    modulTerselesaikan: 0,
    persentaseSelesai: 0,
  });

  useEffect(() => {
    if (!profile) return;

    let unsubscribes: (() => void)[] = [];
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
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Modul Tersedia</p>
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
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Progres Keseluruhan</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {loadingStats ? '...' : `${siswaStats.persentaseSelesai}%`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center space-x-2">
          <Activity className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Aktivitas Terakhir Saya</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <div key={activity.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.aksi}
                    </p>
                    {activity.modul_judul && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Modul: {activity.modul_judul}
                      </p>
                    )}
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
