import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, ExternalLink, Save, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

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
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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
          snapshot.docs.forEach(d => {
            const data = d.data();
            progMap[data.modul_item_id] = { id: d.id, ...data };
            if (data.nilai !== undefined && data.nilai !== null) {
              inputs[data.modul_item_id] = String(data.nilai);
            }
          });
          setProgress(progMap);
          setInputNilai(prev => ({ ...inputs, ...prev })); // Keep existing unsaved inputs if any
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

  const handleSaveNilai = async (itemId: string, progressId: string) => {
    const nilaiStr = inputNilai[itemId];
    if (!nilaiStr || nilaiStr.trim() === '') {
      toast.error('Masukkan nilai terlebih dahulu');
      return;
    }
    
    const nilaiNum = Number(nilaiStr);
    if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      toast.error('Nilai harus berupa angka antara 0 - 100');
      return;
    }

    setSaving(prev => ({ ...prev, [itemId]: true }));
    try {
      if (progressId) {
        await updateDoc(doc(db, 'progres_siswa', progressId), {
          nilai: nilaiNum,
          dinilai_pada: serverTimestamp()
        });
        toast.success('Nilai berhasil disimpan');
      } else {
        toast.error('Data progres tidak ditemukan');
      }
    } catch (error) {
      console.error('Error saving nilai:', error);
      toast.error('Gagal menyimpan nilai');
    } finally {
      setSaving(prev => ({ ...prev, [itemId]: false }));
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

  let sumK1 = 0, countK1 = 0;
  let sumK2 = 0, countK2 = 0;
  let sumK3 = 0, countK3 = 0;
  let allTugasGraded = true;

  k1Items.forEach(item => {
    const p = progress[item.id];
    sumK1 += p?.status_selesai ? 10 : 0;
    countK1++;
  });

  k2Items.forEach(item => {
    const p = progress[item.id];
    sumK2 += p?.nilai || 0;
    countK2++;
  });

  k3Items.forEach(item => {
    const p = progress[item.id];
    if (p?.nilai !== undefined && p?.nilai !== null) {
      sumK3 += p.nilai;
    } else {
      allTugasGraded = false;
    }
    countK3++;
  });

  const rataK1 = countK1 > 0 ? sumK1 / countK1 : 0;
  const rataK2 = countK2 > 0 ? sumK2 / countK2 : 0;
  const rataK3 = countK3 > 0 ? sumK3 / countK3 : 0;

  // Normalize weights
  let w1 = k1Items.length > 0 ? bobot.k1 : 0;
  let w2 = k2Items.length > 0 ? bobot.k2 : 0;
  let w3 = k3Items.length > 0 ? bobot.k3 : 0;
  const totalW = w1 + w2 + w3;
  if (totalW > 0 && totalW < 100) {
    w1 = (w1 / totalW) * 100;
    w2 = (w2 / totalW) * 100;
    w3 = (w3 / totalW) * 100;
  }

  const finalGrade = allTugasGraded ? (rataK1 * (w1/100)) + (rataK2 * (w2/100)) + (rataK3 * (w3/100)) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 pb-20"
    >
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
                <p className="text-xs text-gray-500 dark:text-gray-400">* dinilai otomatis (selesai = 10, belum = 0)</p>
              </div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                Bobot: {Math.round(w1)}%
              </div>
            </div>
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Judul Item</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tipe</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {k1Items.map(item => {
                    const p = progress[item.id];
                    const isDone = p?.status_selesai;
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 dark:text-white font-medium">{item.judul_item}</div>
                          {(p?.jawaban?.jawaban || p?.feedback) && (
                            <div className="mt-2 space-y-2 text-xs">
                              {p?.jawaban?.jawaban && (
                                <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Jawaban: </span>
                                  <span className="text-gray-600 dark:text-gray-400">{p.jawaban.jawaban}</span>
                                </div>
                              )}
                              {p?.feedback && (
                                <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Feedback: </span>
                                  <span className="text-gray-600 dark:text-gray-400">{p.feedback}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 align-top">{item.tipe_item}</td>
                        <td className="px-4 py-3 align-top">
                          {isDone ? (
                            <span className="inline-flex items-center text-green-600 dark:text-green-400">
                              <CheckCircle className="w-4 h-4 mr-1" /> Selesai
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-gray-400">
                              <XCircle className="w-4 h-4 mr-1" /> Belum
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white align-top">
                          {isDone ? '10' : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* KONTEN 2 */}
        {k2Items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden border-l-4 border-l-purple-500">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">KONTEN 2 — Kuis</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">** dinilai otomatis ((jawaban benar / total soal) × 100)</p>
              </div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full">
                Bobot: {Math.round(w2)}%
              </div>
            </div>
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Judul Kuis</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Hasil</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {k2Items.map(item => {
                    const p = progress[item.id];
                    let totalSoal = 0;
                    try {
                      totalSoal = JSON.parse(item.konten || '[]').length;
                    } catch (e) {}
                    
                    // Estimate correct answers from grade (assuming equal weight)
                    const correct = p?.nilai ? Math.round((p.nilai / 100) * totalSoal) : 0;

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 dark:text-white font-medium">{item.judul_item}</div>
                          {(p?.jawaban?.jawaban || p?.feedback) && (
                            <div className="mt-2 space-y-2 text-xs">
                              {p?.jawaban?.jawaban && (
                                <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Jawaban: </span>
                                  <span className="text-gray-600 dark:text-gray-400">{p.jawaban.jawaban}</span>
                                </div>
                              )}
                              {p?.feedback && (
                                <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Feedback: </span>
                                  <span className="text-gray-600 dark:text-gray-400">{p.feedback}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 align-top">
                          {p?.status_selesai ? `${correct} dari ${totalSoal} benar` : 'Belum dikerjakan'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white align-top">
                          {p?.status_selesai ? p.nilai : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                        <div className="flex items-center space-x-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={inputNilai[item.id] || ''}
                            onChange={(e) => setInputNilai(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <button
                            onClick={() => handleSaveNilai(item.id, p?.id)}
                            disabled={saving[item.id] || !p?.id}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {saving[item.id] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Simpan
                          </button>
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
                <span>Konten 1: {rataK1.toFixed(1)} × {Math.round(w1)}%</span>
                <span>= {(rataK1 * (w1/100)).toFixed(2)}</span>
              </div>
            )}
            {k2Items.length > 0 && (
              <div className="flex justify-between">
                <span>Konten 2: {rataK2.toFixed(1)} × {Math.round(w2)}%</span>
                <span>= {(rataK2 * (w2/100)).toFixed(2)}</span>
              </div>
            )}
            {k3Items.length > 0 && (
              <div className="flex justify-between">
                <span>Konten 3: {rataK3.toFixed(1)} × {Math.round(w3)}%</span>
                <span>= {(rataK3 * (w3/100)).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-2 flex justify-between font-bold text-white text-base">
              <span>Nilai Akhir:</span>
              <span>{finalGrade !== null ? finalGrade.toFixed(2) : '-'} / 100</span>
            </div>
          </div>

          {!allTugasGraded && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-4 py-3 rounded-lg text-sm flex items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Menunggu penilaian tugas... Nilai akhir belum dapat dihitung.
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
