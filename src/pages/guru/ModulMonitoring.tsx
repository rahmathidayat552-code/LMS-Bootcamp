import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowLeft, Users, CheckCircle, Clock, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface SiswaProgress {
  id: string;
  nama_lengkap: string;
  kelas_id: string;
  completedItems: number;
  totalItems: number;
  lastActive: string;
  status: 'Belum Mulai' | 'Sedang Mengerjakan' | 'Selesai';
  score: number;
}

export default function ModulMonitoring() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modul, setModul] = useState<any>(null);
  const [studentsProgress, setStudentsProgress] = useState<SiswaProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let unsubProgress: (() => void) | null = null;

    const fetchData = async () => {
      try {
        // 1. Get Modul Details
        const modulDoc = await getDoc(doc(db, 'moduls', id));
        if (!modulDoc.exists()) {
          toast.error('Modul tidak ditemukan');
          navigate('/guru/modul');
          return;
        }
        setModul({ id: modulDoc.id, ...modulDoc.data() });

        // 2. Get Total Items in Modul
        const itemsSnap = await getDocs(query(collection(db, 'modul_items'), where('modul_id', '==', id)));
        const totalItems = itemsSnap.size;

        // 3. Get All Students (we could filter by target_kelas_ids but let's just get all and filter locally for simplicity or just show those who have progress)
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'SISWA')));
        const allStudents = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 4. Listen to Progress Realtime
        const qProgress = query(collection(db, 'progres_siswa'), where('modul_id', '==', id));
        unsubProgress = onSnapshot(qProgress, (snapshot) => {
          const progressByStudent: Record<string, any[]> = {};
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!progressByStudent[data.siswa_id]) {
              progressByStudent[data.siswa_id] = [];
            }
            progressByStudent[data.siswa_id].push(data);
          });

          const progressList: SiswaProgress[] = allStudents.map(student => {
            const studentProgress = progressByStudent[student.id] || [];
            const completedItems = studentProgress.filter(p => p.status_selesai).length;
            
            let status: 'Belum Mulai' | 'Sedang Mengerjakan' | 'Selesai' = 'Belum Mulai';
            if (completedItems > 0) {
              status = completedItems >= totalItems ? 'Selesai' : 'Sedang Mengerjakan';
            }

            // Find last active
            let lastActive = '';
            let latestTime = 0;
            let totalScore = 0;

            studentProgress.forEach(p => {
              if (p.updated_at) {
                const time = new Date(p.updated_at).getTime();
                if (time > latestTime) {
                  latestTime = time;
                  lastActive = p.updated_at;
                }
              }
              if (p.nilai) {
                totalScore += p.nilai;
              }
            });

            return {
              id: student.id,
              nama_lengkap: (student as any).nama_lengkap || 'Unknown',
              kelas_id: (student as any).kelas_id || '',
              completedItems,
              totalItems,
              lastActive,
              status,
              score: totalScore
            };
          });

          // Sort by status (Sedang Mengerjakan first, then Selesai, then Belum Mulai)
          progressList.sort((a, b) => {
            const order = { 'Sedang Mengerjakan': 1, 'Selesai': 2, 'Belum Mulai': 3 };
            return order[a.status] - order[b.status];
          });

          // Filter only students who are targeted by this module
          const targetKelasIds = modulDoc.data().target_kelas_ids || [];
          const targetSiswaIds = modulDoc.data().target_siswa_ids || [];
          const tipeTarget = modulDoc.data().tipe_target;

          const filteredList = progressList.filter(s => {
            if (tipeTarget === 'KELAS') return targetKelasIds.includes(s.kelas_id);
            if (tipeTarget === 'SISWA') return targetSiswaIds.includes(s.id);
            return targetKelasIds.includes(s.kelas_id) || targetSiswaIds.includes(s.id);
          });

          setStudentsProgress(filteredList);
          setLoading(false);
        });

      } catch (error) {
        console.error('Error fetching monitoring data:', error);
        toast.error('Gagal memuat data monitoring');
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (unsubProgress) unsubProgress();
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/guru/modul')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Live Monitoring: {modul?.judul_modul}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pantau progres siswa secara real-time
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Siswa</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{studentsProgress.length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Selesai</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {studentsProgress.filter(s => s.status === 'Selesai').length}
              </h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
              <Activity className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sedang Mengerjakan</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {studentsProgress.filter(s => s.status === 'Sedang Mengerjakan').length}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Siswa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progres</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Nilai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aktivitas Terakhir</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {studentsProgress.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{student.nama_lengkap}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      student.status === 'Selesai' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      student.status === 'Sedang Mengerjakan' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-2 max-w-[100px]">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${student.totalItems > 0 ? (student.completedItems / student.totalItems) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {student.completedItems}/{student.totalItems}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {student.score > 0 ? student.score : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {student.lastActive ? new Date(student.lastActive).toLocaleString('id-ID') : '-'}
                  </td>
                </tr>
              ))}
              {studentsProgress.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Belum ada siswa yang ditugaskan atau data tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
