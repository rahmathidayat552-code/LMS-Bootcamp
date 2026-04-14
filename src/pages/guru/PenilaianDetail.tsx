import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, updateDoc, serverTimestamp, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, ExternalLink, Save, CheckCircle, XCircle, ChevronUp } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { calculateGrade } from '../../utils/gradeCalculator';

export default function PenilaianDetail() {
  const { modulId, siswaId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [modul, setModul] = useState<any>(null);
  const [siswa, setSiswa] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [bobot, setBobot] = useState({ k1: 20, k2: 30, k3: 50 });
  const [inputNilai, setInputNilai] = useState<Record<string, string>>({});
  const [inputCatatan, setInputCatatan] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (!modulId || !siswaId) return;

    const fetchData = async () => {
      try {
        // 1. Get Modul
        const modulDoc = await getDoc(doc(db, 'moduls', modulId));
        if (!modulDoc.exists()) {
          navigate('/guru/penilaian');
          return;
        }
        setModul({ id: modulDoc.id, ...modulDoc.data() });

        // 2. Get Siswa
        const siswaDoc = await getDoc(doc(db, 'users', siswaId));
        if (!siswaDoc.exists()) {
          navigate(`/guru/penilaian/${modulId}`);
          return;
        }
        const siswaData = siswaDoc.data();
        
        // Get Kelas name
        let kelasNama = 'Unknown';
        if (siswaData.kelas_id) {
          const kelasDoc = await getDoc(doc(db, 'kelas', siswaData.kelas_id));
          if (kelasDoc.exists()) kelasNama = kelasDoc.data().nama_kelas;
        }
        setSiswa({ id: siswaDoc.id, ...siswaData, kelas_nama: kelasNama });

        // 3. Get Modul Items
        const itemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', modulId));
        const itemsSnapshot = await getDocs(itemsQuery);
        const itemsData = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        itemsData.sort((a: any, b: any) => a.urutan - b.urutan);
        setItems(itemsData);

        // 4. Get Penilaian Settings
        const settingsDoc = await getDoc(doc(db, 'penilaian_settings', modulId));
        if (settingsDoc.exists()) {
          const s = settingsDoc.data();
          setBobot({ k1: s.bobot_konten1, k2: s.bobot_konten2, k3: s.bobot_konten3 });
        }

        // 5. Setup real-time listener for progress
        const progressQuery = query(
          collection(db, 'progres_siswa'), 
          where('modul_id', '==', modulId),
          where('siswa_id', '==', siswaId)
        );
        
        const unsub = onSnapshot(progressQuery, (snapshot) => {
          const progMap: Record<string, any> = {};
          const inputs: Record<string, string> = {};
          const catatans: Record<string, string> = {};
          snapshot.docs.forEach(d => {
            const data = d.data();
            progMap[data.modul_item_id] = { id: d.id, ...data };
            if (data.nilai !== undefined && data.nilai !== null) {
              inputs[data.modul_item_id] = String(data.nilai);
            }
            if (data.catatan_guru) {
              catatans[data.modul_item_id] = data.catatan_guru;
            }
          });
          setProgress(progMap);
          setInputNilai(prev => ({ ...inputs, ...prev })); // Keep existing unsaved inputs if any
          setInputCatatan(prev => ({ ...catatans, ...prev }));
          setLoading(false);
        });

        return () => unsub();

      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [modulId, siswaId, navigate]);

  const [isSavingAll, setIsSavingAll] = useState(false);

  const handleSaveSemuaNilai = async () => {
    setIsSavingAll(true);
    try {
      const batch = writeBatch(db);
      let hasChanges = false;

      for (const item of items) {
        const nilaiStr = inputNilai[item.id];
        const catatanStr = inputCatatan[item.id];
        
        // Only process if there's an input value or a note
        if (nilaiStr !== undefined || catatanStr !== undefined) {
          const p = progress[item.id];
          const progressId = p?.id;
          
          let nilaiNum: number | null = null;
          if (nilaiStr !== undefined && nilaiStr !== '') {
            nilaiNum = Number(nilaiStr);
            if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
              toast.error(`Nilai untuk "${item.judul_item}" harus antara 0 - 100`);
              setIsSavingAll(false);
              return;
            }
          }

          if (progressId) {
            const updateData: any = {
              dinilai_pada: serverTimestamp()
            };
            if (nilaiNum !== null) updateData.nilai = nilaiNum;
            if (catatanStr !== undefined) updateData.catatan_guru = catatanStr;
            
            batch.update(doc(db, 'progres_siswa', progressId), updateData);
            hasChanges = true;
          } else {
            // Create new progress if it doesn't exist (e.g. teacher grades an unstarted item)
            const newProgressRef = doc(collection(db, 'progres_siswa'));
            const newData: any = {
              siswa_id: siswaId,
              modul_id: modulId,
              modul_item_id: item.id,
              status_selesai: true, // Mark as done if graded
              dinilai_pada: serverTimestamp(),
              created_at: serverTimestamp(),
              updated_at: serverTimestamp()
            };
            if (nilaiNum !== null) newData.nilai = nilaiNum;
            if (catatanStr !== undefined) newData.catatan_guru = catatanStr;
            
            batch.set(newProgressRef, newData);
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        await batch.commit();
        toast.success('Semua nilai dan catatan berhasil disimpan');
        
        // Create a single notification for the student
        if (siswaId) {
          await addDoc(collection(db, 'notifications'), {
            user_id: siswaId,
            title: 'Nilai Diperbarui',
            message: `Guru telah memperbarui nilai untuk modul ${modul?.judul_modul || ''}.`,
            link: `/siswa/modul/${modulId}`,
            is_read: false,
            created_at: serverTimestamp()
          });
        }
        
        // Redirect back to the grading list
        navigate(`/guru/penilaian/${modulId}`);
      } else {
        toast.info('Tidak ada perubahan untuk disimpan');
      }
    } catch (error) {
      console.error("Error saving all grades:", error);
      toast.error('Terjadi kesalahan saat menyimpan nilai');
    } finally {
      setIsSavingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Calculate Grades
  const k1Items = items.filter(i => ['MATERI', 'PDF', 'YOUTUBE'].includes(i.tipe_item));
  const k2Items = items.filter(i => i.tipe_item === 'KUIS');
  const k3Items = items.filter(i => i.tipe_item === 'TUGAS');

  // Create a preview progress list that merges saved progress with current manual inputs
  const previewProgressList = items.map(item => {
    const p = progress[item.id] || { modul_item_id: item.id, status_selesai: false };
    const inputVal = inputNilai[item.id];
    
    let previewNilai = p.nilai;
    let previewStatus = p.status_selesai;

    if (inputVal !== undefined && inputVal !== '') {
      const num = Number(inputVal);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        previewNilai = num;
        previewStatus = true; // Consider it completed if manually graded
      }
    }

    return {
      ...p,
      modul_item_id: item.id,
      nilai: previewNilai,
      status_selesai: previewStatus
    };
  });

  const gradeResult = calculateGrade(items, previewProgressList, bobot);

  // Normalize weights for UI display
  let w1 = k1Items.length > 0 ? bobot.k1 : 0;
  let w2 = k2Items.length > 0 ? bobot.k2 : 0;
  let w3 = k3Items.length > 0 ? bobot.k3 : 0;
  const totalW = w1 + w2 + w3;
  if (totalW > 0 && totalW < 100) {
    w1 = (w1 / totalW) * 100;
    w2 = (w2 / totalW) * 100;
    w3 = (w3 / totalW) * 100;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 pb-20 relative"
    >
      {/* Floating Top Grade */}
      <div className="fixed top-20 md:top-24 right-4 md:right-8 z-40 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-3 rounded-2xl shadow-xl border border-gray-700 dark:border-gray-200 flex flex-col items-end transition-all">
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Nilai Akhir</span>
        <span className="text-2xl font-bold">
          {gradeResult.finalGrade !== null ? gradeResult.finalGrade.toFixed(2) : '-'}
        </span>
      </div>

      {/* Breadcrumb */}
      <nav className="flex text-sm text-gray-500 dark:text-gray-400">
        <ol className="flex items-center space-x-2">
          <li>
            <button onClick={() => navigate('/guru/penilaian')} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Penilaian
            </button>
          </li>
          <li><span className="mx-2">/</span></li>
          <li>
            <button onClick={() => navigate(`/guru/penilaian/${modulId}`)} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[150px] block">
              {modul?.judul_modul}
            </button>
          </li>
          <li><span className="mx-2">/</span></li>
          <li className="text-gray-900 dark:text-white font-medium truncate max-w-[150px]">
            {siswa?.nama_lengkap}
          </li>
        </ol>
      </nav>

      <div className="flex items-center space-x-4">
        <button 
          onClick={() => navigate(`/guru/penilaian/${modulId}`)}
          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{siswa?.nama_lengkap}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{siswa?.kelas_nama}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* KONTEN 1 */}
        {k1Items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden border-l-4 border-l-blue-500">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">KONTEN 1 — Materi Pembelajaran</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">* dinilai otomatis (selesai = 100, belum = 0), bisa diubah manual</p>
              </div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                Bobot: {Math.round(bobot.k1)}%
              </div>
            </div>
            <div className="p-4 space-y-6">
              {k1Items.map(item => {
                const p = progress[item.id];
                const isDone = p?.status_selesai;
                const isGraded = p?.nilai !== undefined && p?.nilai !== null;
                const displayNilai = isGraded ? p.nilai : (isDone ? 100 : 0);
                
                return (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-gray-900 dark:text-white">{item.judul_item} <span className="text-sm font-normal text-gray-500">({item.tipe_item})</span></h4>
                      {isDone ? (
                        <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3 mr-1" /> Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                          <XCircle className="w-3 h-3 mr-1" /> Belum
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {item.pertanyaan_feedback && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Jawaban Pertanyaan:</p>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                              {p?.jawaban?.jawaban || <span className="italic text-gray-400">Tidak ada jawaban</span>}
                            </div>
                          </div>
                        )}
                        
                        {item.wajib_feedback !== false && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Feedback Siswa:</p>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                              {p?.feedback || <span className="italic text-gray-400">Tidak ada feedback</span>}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Beri Nilai Manual (0 - 100)
                        </label>
                        <div className="flex flex-col space-y-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={inputNilai[item.id] || ''}
                            onChange={(e) => setInputNilai(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-full md:w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder={String(displayNilai)}
                          />
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Catatan Guru (Opsional)
                            </label>
                            <textarea
                              value={inputCatatan[item.id] || ''}
                              onChange={(e) => setInputCatatan(prev => ({ ...prev, [item.id]: e.target.value }))}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                              placeholder="Berikan masukan atau catatan untuk siswa..."
                            />
                          </div>

                        </div>
                        <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1" /> Nilai saat ini: {displayNilai} {isGraded ? '(Manual)' : '(Otomatis)'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KONTEN 2 */}
        {k2Items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden border-l-4 border-l-purple-500">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">KONTEN 2 — Kuis</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">** dinilai otomatis, bisa diubah manual</p>
              </div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full">
                Bobot: {Math.round(w2)}%
              </div>
            </div>
            <div className="p-4 space-y-6">
              {k2Items.map(item => {
                const p = progress[item.id];
                let totalSoal = 0;
                try {
                  totalSoal = JSON.parse(item.konten || '[]').length;
                } catch (e) {}
                
                const isDone = p?.status_selesai;
                const isGraded = p?.nilai !== undefined && p?.nilai !== null;
                const displayNilai = isGraded ? p.nilai : 0;
                const correct = isGraded ? Math.round((p.nilai / 100) * totalSoal) : 0;

                return (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-gray-900 dark:text-white">{item.judul_item}</h4>
                      {isDone ? (
                        <span className="inline-flex items-center text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3 mr-1" /> {correct} dari {totalSoal} benar
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                          <XCircle className="w-3 h-3 mr-1" /> Belum dikerjakan
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {item.pertanyaan_feedback && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Jawaban Pertanyaan:</p>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                              {p?.jawaban?.jawaban || <span className="italic text-gray-400">Tidak ada jawaban</span>}
                            </div>
                          </div>
                        )}
                        
                        {item.wajib_feedback !== false && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Feedback Siswa:</p>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                              {p?.feedback || <span className="italic text-gray-400">Tidak ada feedback</span>}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Ubah Nilai Manual (0 - 100)
                        </label>
                        <div className="flex flex-col space-y-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={inputNilai[item.id] || ''}
                            onChange={(e) => setInputNilai(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-full md:w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder={String(displayNilai)}
                          />
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Catatan Guru (Opsional)
                            </label>
                            <textarea
                              value={inputCatatan[item.id] || ''}
                              onChange={(e) => setInputCatatan(prev => ({ ...prev, [item.id]: e.target.value }))}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                              placeholder="Berikan masukan atau catatan untuk siswa..."
                            />
                          </div>

                        </div>
                        {isDone && (
                          <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" /> Nilai saat ini: {displayNilai}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KONTEN 3 */}
        {k3Items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden border-l-4 border-l-orange-500">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">KONTEN 3 — Tugas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">*** dinilai manual oleh guru</p>
              </div>
              <div className="text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
                Bobot: {Math.round(w3)}%
              </div>
            </div>
            <div className="p-4 space-y-6">
              {k3Items.map(item => {
                const p = progress[item.id];
                const isGraded = p?.nilai !== undefined && p?.nilai !== null;
                
                return (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-4">{item.judul_item}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pengumpulan:</p>
                          {p?.link_tugas ? (
                            <a 
                              href={p.link_tugas} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" /> Buka Link Tugas
                            </a>
                          ) : p?.file_submission ? (
                            <a 
                              href={p.file_submission} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" /> Buka File Tugas
                            </a>
                          ) : (
                            <span className="text-sm text-gray-500 italic">Belum ada pengumpulan</span>
                          )}
                        </div>

                        {item.pertanyaan_feedback && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Jawaban Pertanyaan:</p>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                              {p?.jawaban?.jawaban || <span className="italic text-gray-400">Tidak ada jawaban</span>}
                            </div>
                          </div>
                        )}
                        
                        {item.wajib_feedback !== false && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Feedback Siswa:</p>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                              {p?.feedback || <span className="italic text-gray-400">Tidak ada feedback</span>}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Beri Nilai (0 - 100)
                        </label>
                        <div className="flex flex-col space-y-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={inputNilai[item.id] || ''}
                            onChange={(e) => setInputNilai(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-full md:w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nilai"
                          />
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Catatan Guru (Opsional)
                            </label>
                            <textarea
                              value={inputCatatan[item.id] || ''}
                              onChange={(e) => setInputCatatan(prev => ({ ...prev, [item.id]: e.target.value }))}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                              placeholder="Berikan masukan atau catatan untuk siswa..."
                            />
                          </div>

                        </div>
                        {isGraded && (
                          <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" /> Nilai saat ini: {p.nilai}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RINGKASAN */}
        <div className="bg-gray-900 dark:bg-black rounded-xl shadow-sm border border-gray-800 p-6 text-white">
          <h3 className="font-bold text-lg mb-4">RINGKASAN NILAI AKHIR</h3>
          
          <div className="space-y-2 mb-6 text-sm text-gray-300">
            {k1Items.length > 0 && (
              <div className="flex justify-between">
                <span>Konten 1: {gradeResult.breakdown.K1 !== null ? gradeResult.breakdown.K1.toFixed(1) : '0'} × {Math.round(w1)}%</span>
                <span>= {gradeResult.breakdown.K1 !== null ? (gradeResult.breakdown.K1 * (w1/100)).toFixed(2) : '0.00'}</span>
              </div>
            )}
            {k2Items.length > 0 && (
              <div className="flex justify-between">
                <span>Konten 2: {gradeResult.breakdown.K2 !== null ? gradeResult.breakdown.K2.toFixed(1) : '0'} × {Math.round(w2)}%</span>
                <span>= {gradeResult.breakdown.K2 !== null ? (gradeResult.breakdown.K2 * (w2/100)).toFixed(2) : '0.00'}</span>
              </div>
            )}
            {k3Items.length > 0 && (
              <div className="flex justify-between">
                <span>Konten 3: {gradeResult.breakdown.K3 !== null ? gradeResult.breakdown.K3.toFixed(1) : '0'} × {Math.round(w3)}%</span>
                <span>= {gradeResult.breakdown.K3 !== null ? (gradeResult.breakdown.K3 * (w3/100)).toFixed(2) : '0.00'}</span>
              </div>
            )}
            
            <div className="border-t border-gray-700 pt-2 flex justify-between text-gray-400 text-sm">
              <span>Nilai Saat Ini (Current Grade):</span>
              <span>{gradeResult.currentGrade !== null ? gradeResult.currentGrade.toFixed(2) : '0.00'} / 100</span>
            </div>

            <div className="flex justify-between font-bold text-white text-base">
              <span>Nilai Akhir (Final Grade):</span>
              <span>{gradeResult.finalGrade !== null ? gradeResult.finalGrade.toFixed(2) : '-'} / 100</span>
            </div>
          </div>

          {gradeResult.needsGrading && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-4 py-3 rounded-lg text-sm flex items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Menunggu penilaian tugas... Nilai akhir belum dapat dihitung.
            </div>
          )}
        </div>

      </div>

      {/* Global Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-10">
        <div className="max-w-7xl mx-auto flex justify-end gap-3">
          <button
            onClick={() => navigate(`/guru/penilaian/${modulId}`)}
            className="flex items-center justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors w-full md:w-auto font-medium shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Kembali
          </button>
          <button
            onClick={handleSaveSemuaNilai}
            disabled={isSavingAll}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 w-full md:w-auto font-medium shadow-sm"
          >
            {isSavingAll ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Simpan Semua Perubahan Nilai
          </button>
        </div>
      </div>
      
      {/* Spacer to prevent content from being hidden behind the fixed button */}
      <div className="h-24"></div>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-40 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        title="Kembali ke atas"
      >
        <ChevronUp className="w-6 h-6" />
      </button>
    </motion.div>
  );
}
