import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Clock, CheckCircle, ChevronRight, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../utils/dateUtils';

interface Modul {
  id: string;
  judul_modul: string;
  mata_pelajaran: string;
  deskripsi: string;
  guru_id: string;
  target_kelas_ids: string[];
  target_siswa_ids: string[];
  tipe_target: 'KELAS' | 'SISWA';
  is_published: boolean;
  ikon?: string;
  prasyarat_id?: string;
  created_at: any;
}

export default function ModulSiswaList() {
  const { profile } = useAuth();
  const [moduls, setModuls] = useState<Modul[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [kelasName, setKelasName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModulsAndProgress = async () => {
      if (!profile) return;

      try {
        // Fetch Kelas Name if exists
        if (profile.kelas_id) {
          const kSnap = await getDoc(doc(db, 'kelas', profile.kelas_id));
          if (kSnap.exists()) {
            setKelasName(kSnap.data().nama_kelas);
          }
        }

        // Fetch Moduls
        const modulsRef = collection(db, 'moduls');
        const q = query(modulsRef);

        const snapshot = await getDocs(q);
        console.log("Snapshot empty?", snapshot.empty);
        console.log("Snapshot size:", snapshot.size);

        let fetchedModuls = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Modul[];

        console.log("Total Moduls Fetched from Firestore:", fetchedModuls.length);
        console.log("Raw Fetched Moduls:", fetchedModuls);
        console.log("Student Profile:", profile);

        // Filter published modules
        fetchedModuls = fetchedModuls.filter(m => {
          // Handle both boolean and string "true" for is_published
          const isPublished = m.is_published === true || String(m.is_published) === 'true';
          if (!isPublished) {
            console.log("Modul rejected (not published):", m.judul_modul, "is_published value:", m.is_published);
          }
          return isPublished;
        });

        console.log("Moduls after Publication Filter:", fetchedModuls.length);
        
        console.log("Fetched Published Moduls:", fetchedModuls);

        // Sort in memory
        fetchedModuls.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        // Filter moduls based on student's class or individual targeting
        const filteredModuls = fetchedModuls.filter(modul => {
          const studentKelasId = (profile.kelas_id || '').trim();
          const studentUid = profile.uid;

          console.log("Evaluating Modul:", modul.judul_modul, "Tipe Target:", modul.tipe_target);
          console.log("Student Kelas ID:", studentKelasId, "Student UID:", studentUid);

          const targetKelasIds = Array.isArray(modul.target_kelas_ids) 
            ? modul.target_kelas_ids.map(id => String(id).trim()) 
            : [];
          const targetSiswaIds = Array.isArray(modul.target_siswa_ids) 
            ? modul.target_siswa_ids.map(id => String(id).trim()) 
            : [];

          console.log("Target Kelas IDs:", targetKelasIds);
          console.log("Target Siswa IDs:", targetSiswaIds);

          let isMatch = false;

          if (modul.tipe_target === 'KELAS') {
            isMatch = targetKelasIds.includes(studentKelasId);
            console.log("Match KELAS result:", isMatch);
          } else if (modul.tipe_target === 'SISWA') {
            isMatch = targetSiswaIds.includes(studentUid);
            console.log("Match SISWA result:", isMatch);
          } else {
            // Fallback for missing or unknown tipe_target: check both
            console.log("Unknown or missing tipe_target, checking both arrays...");
            isMatch = targetKelasIds.includes(studentKelasId) || targetSiswaIds.includes(studentUid);
            console.log("Fallback match result:", isMatch);
          }

          return isMatch;
        });

        console.log("Filtered Moduls for Student:", filteredModuls);

        setModuls(filteredModuls);

        // Fetch Progress
        const progressRef = collection(db, 'progres_siswa');
        const qProgress = query(progressRef, where('siswa_id', '==', profile.uid));
        const snapshotProgress = await getDocs(qProgress);
        
        // Count completed items per modul
        const progressCounts: Record<string, Set<string>> = {};
        snapshotProgress.docs.forEach(doc => {
          const data = doc.data();
          if (data.status_selesai) {
            if (!progressCounts[data.modul_id]) {
              progressCounts[data.modul_id] = new Set();
            }
            progressCounts[data.modul_id].add(data.modul_item_id);
          }
        });

        // Fetch total items per modul to calculate percentage
        // We need to query modul_items for all filtered moduls
        const modulIds = filteredModuls.map(m => m.id);
        const percentages: Record<string, number> = {};
        
        if (modulIds.length > 0) {
          // Note: Firestore 'in' query supports max 10 items. 
          // For a real app with many modules, you might need to chunk this or fetch differently.
          // Here we'll do individual queries for simplicity and correctness.
          await Promise.all(modulIds.map(async (modulId) => {
            const itemsRef = collection(db, 'modul_items');
            const qItems = query(itemsRef, where('modul_id', '==', modulId));
            const itemsSnapshot = await getDocs(qItems);
            const totalItems = itemsSnapshot.size;
            const completedItems = progressCounts[modulId]?.size || 0;
            
            percentages[modulId] = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
          }));
        }

        setProgress(percentages);

      } catch (error) {
        console.error('Error fetching moduls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModulsAndProgress();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Modul Belajar</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Daftar modul yang ditugaskan untuk Anda</p>
        </div>
        <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${profile?.kelas_id ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {profile?.kelas_id ? `Kelas: ${kelasName || profile.kelas_id}` : 'Kelas Belum Teratur'}
          </span>
        </div>
      </div>

      {moduls.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Belum ada modul</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {profile?.kelas_id 
              ? "Belum ada modul yang dipublikasikan untuk kelas Anda saat ini. Silakan cek kembali nanti."
              : "Anda belum terdaftar di kelas manapun. Silakan hubungi admin atau guru untuk mendaftarkan Anda ke dalam kelas agar dapat melihat modul belajar."}
          </p>
          {!profile?.kelas_id && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl p-4 max-w-md mx-auto text-left shadow-sm">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <span className="font-bold">Penting:</span> Modul belajar biasanya ditargetkan berdasarkan kelas. Tanpa kelas, Anda tidak akan melihat modul apapun kecuali ditargetkan secara personal.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {moduls.map((modul) => {
            const isLocked = modul.prasyarat_id && (progress[modul.prasyarat_id] || 0) < 100;
            
            return (
              <div
                key={modul.id}
                className={`group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200 ${
                  isLocked ? 'opacity-75 grayscale-[0.5]' : 'hover:shadow-md'
                }`}
              >
                {modul.ikon && (
                  <div className="h-40 w-full overflow-hidden border-b border-gray-100 dark:border-gray-700 relative">
                    <img src={modul.ikon} alt={modul.judul_modul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {isLocked && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="bg-white/90 dark:bg-gray-800/90 p-3 rounded-full shadow-lg">
                          <Lock className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${isLocked ? 'bg-gray-100 dark:bg-gray-700 text-gray-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                      {isLocked ? <Lock className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                      {modul.mata_pelajaran}
                    </span>
                  </div>
                  
                  <h3 className={`text-lg font-semibold mb-2 transition-colors ${
                    isLocked ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`}>
                    {modul.judul_modul}
                  </h3>
                  
                  <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                    {modul.deskripsi}
                  </p>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Progres Belajar</span>
                        {progress[modul.id] === 100 ? (
                          <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 uppercase">
                            <CheckCircle className="w-2.5 h-2.5 mr-1" />
                            Selesai
                          </span>
                        ) : progress[modul.id] > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 uppercase">
                            Berjalan
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase">
                            Baru
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-bold ${progress[modul.id] === 100 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {progress[modul.id] || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden border border-gray-200 dark:border-gray-600">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          progress[modul.id] === 100 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-blue-600'
                        }`} 
                        style={{ width: `${progress[modul.id] || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-1.5" />
                      <span>
                        {modul.created_at && formatDate(modul.created_at, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    {isLocked ? (
                      <div className="flex items-center text-gray-400 text-sm font-medium">
                        Terkunci
                      </div>
                    ) : (
                      <Link 
                        to={`/siswa/modul/${modul.id}`}
                        className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                      >
                        Mulai Belajar
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
