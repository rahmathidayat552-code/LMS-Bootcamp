import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, Clock, Search, Filter, ExternalLink, Save, User, BookOpen, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../utils/dateUtils';

interface Submission {
  id: string;
  siswa_id: string;
  modul_id: string;
  modul_item_id: string;
  status_selesai: boolean;
  nilai?: number;
  link_tugas?: string;
  file_submission?: string;
  selesai_pada: any;
  siswa_nama?: string;
  modul_judul?: string;
  item_judul?: string;
}

export default function Penilaian() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModul, setFilterModul] = useState('');
  const [moduls, setModuls] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number | ''>('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch Teacher's Moduls
        const modulsRef = collection(db, 'moduls');
        const qModuls = query(modulsRef, where('guru_id', '==', user.uid));
        const modulsSnapshot = await getDocs(qModuls);
        const modulsData = modulsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setModuls(modulsData);

        // Fetch Submissions for these moduls
        const modulIds = modulsData.map(m => m.id);
        if (modulIds.length === 0) {
          setSubmissions([]);
          setLoading(false);
          return;
        }

        const submissionsRef = collection(db, 'progres_siswa');
        // We fetch all progress for these moduls
        // Firestore 'in' query supports max 10 items. 
        // For simplicity, we'll fetch all and filter in memory if many.
        // But let's try to fetch only those that need grading (TUGAS)
        const qSubmissions = query(submissionsRef);
        const snapshot = await getDocs(qSubmissions);
        
        const allSubmissions = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data();
          if (!modulIds.includes(data.modul_id)) return null;

          // Fetch Siswa Name
          const siswaDoc = await getDoc(doc(db, 'users', data.siswa_id));
          const siswaData = siswaDoc.data();

          // Fetch Modul Item Title
          const itemDoc = await getDoc(doc(db, 'modul_items', data.modul_item_id));
          const itemData = itemDoc.data();

          // Only include if it's a TUGAS or KUIS (though KUIS is auto-graded)
          if (itemData?.tipe_item !== 'TUGAS' && itemData?.tipe_item !== 'KUIS') return null;

          const currentModul = modulsData.find(m => m.id === data.modul_id);

          return {
            id: d.id,
            ...data,
            siswa_nama: siswaData?.nama_lengkap || 'Siswa Tidak Dikenal',
            modul_judul: (currentModul as any)?.judul_modul || 'Modul Tidak Dikenal',
            item_judul: itemData?.judul_item || 'Item Tidak Dikenal'
          } as Submission;
        }));

        setSubmissions(allSubmissions.filter(s => s !== null) as Submission[]);
      } catch (error) {
        console.error('Error fetching submissions:', error);
        toast.error('Gagal memuat data penilaian');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleGrade = async (submission: Submission) => {
    if (editScore === '' || editScore < 0 || editScore > 100) {
      toast.error('Masukkan nilai antara 0 - 100');
      return;
    }

    try {
      const docRef = doc(db, 'progres_siswa', submission.id);
      await updateDoc(docRef, {
        nilai: Number(editScore),
        dinilai_pada: new Date().toISOString()
      });

      setSubmissions(prev => prev.map(s => 
        s.id === submission.id ? { ...s, nilai: Number(editScore) } : s
      ));
      setEditingId(null);
      setEditScore('');
      toast.success('Nilai berhasil disimpan');
    } catch (error) {
      console.error('Error updating grade:', error);
      toast.error('Gagal menyimpan nilai');
    }
  };

  const filteredSubmissions = submissions.filter(s => 
    !filterModul || s.modul_id === filterModul
  ).sort((a, b) => {
    // Sort by ungraded first, then by date
    if (a.nilai === undefined && b.nilai !== undefined) return -1;
    if (a.nilai !== undefined && b.nilai === undefined) return 1;
    return new Date(b.selesai_pada?.toDate() || 0).getTime() - new Date(a.selesai_pada?.toDate() || 0).getTime();
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Penilaian Tugas</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Berikan nilai untuk tugas dan kuis yang dikerjakan siswa.</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterModul}
            onChange={(e) => setFilterModul(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Semua Modul</option>
            {moduls.map(m => (
              <option key={m.id} value={m.id}>{m.judul_modul}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Siswa</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Modul / Item</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Tgl Kumpul</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Tugas</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Nilai</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSubmissions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mr-3">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{s.siswa_nama}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">{s.modul_judul}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{s.item_judul}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {formatDateTime(s.selesai_pada, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-1">
                      {s.link_tugas && (
                        <a 
                          href={s.link_tugas} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Buka Link
                        </a>
                      )}
                      {s.file_submission && (
                        <a 
                          href={s.file_submission} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Lihat File
                        </a>
                      )}
                      {!s.link_tugas && !s.file_submission && (
                        <span className="text-xs text-gray-400 italic">Tidak ada lampiran</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {s.nilai !== undefined ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="w-3 h-3 mr-1" /> Dinilai
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <Clock className="w-3 h-3 mr-1" /> Menunggu
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === s.id ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editScore}
                        onChange={(e) => setEditScore(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-20 px-2 py-1 text-sm border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className={`text-lg font-bold ${s.nilai !== undefined ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300'}`}>
                        {s.nilai !== undefined ? s.nilai : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === s.id ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleGrade(s)}
                          className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title="Simpan"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditScore(''); }}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Batal"
                        >
                          <ExternalLink className="w-5 h-5 rotate-45" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(s.id); setEditScore(s.nilai || ''); }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {s.nilai !== undefined ? 'Ubah Nilai' : 'Beri Nilai'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSubmissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Belum ada tugas yang dikumpulkan untuk dinilai.
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
