import React, { useState, useEffect } from 'react';
import { getDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Save, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function PenilaianBobot() {
  const { modulId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modul, setModul] = useState<any>(null);
  
  const [k1, setK1] = useState<number>(20);
  const [k2, setK2] = useState<number>(30);
  const [k3, setK3] = useState<number>(50);

  useEffect(() => {
    if (!modulId) return;

    const fetchData = async () => {
      try {
        const modulDoc = await getDoc(doc(db, 'moduls', modulId));
        if (!modulDoc.exists()) {
          navigate('/guru/penilaian');
          return;
        }
        setModul({ id: modulDoc.id, ...modulDoc.data() });

        const settingsDoc = await getDoc(doc(db, 'penilaian_settings', modulId));
        if (settingsDoc.exists()) {
          const s = settingsDoc.data();
          setK1(s.bobot_konten1);
          setK2(s.bobot_konten2);
          setK3(s.bobot_konten3);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [modulId, navigate]);

  const total = k1 + k2 + k3;
  const isTotalValid = total === 100;

  const handleSave = async () => {
    if (!isTotalValid || !user || !modulId) return;

    setSaving(true);
    try {
      await setDoc(doc(db, 'penilaian_settings', modulId), {
        modul_id: modulId,
        guru_id: user.uid,
        bobot_konten1: k1,
        bobot_konten2: k2,
        bobot_konten3: k3,
        updated_at: serverTimestamp()
      });
      toast.success('Bobot nilai berhasil disimpan');
      navigate('/guru/penilaian');
    } catch (error) {
      console.error('Error saving bobot:', error);
      toast.error('Gagal menyimpan pengaturan bobot');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setK1(20);
    setK2(30);
    setK3(50);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
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
          <li className="truncate max-w-[150px]">
            {modul?.judul_modul}
          </li>
          <li><span className="mx-2">/</span></li>
          <li className="text-gray-900 dark:text-white font-medium">
            Atur Bobot Nilai
          </li>
        </ol>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Atur Bobot Nilai</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{modul?.judul_modul}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 space-y-6">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Konten 1 — Materi, PDF, Video</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Dinilai otomatis (Selesai = 10, Belum = 0)</p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={k1}
                  onChange={(e) => setK1(Number(e.target.value))}
                  className="w-20 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-gray-500 font-medium">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Konten 2 — Kuis</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Dinilai otomatis berdasarkan jawaban benar</p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={k2}
                  onChange={(e) => setK2(Number(e.target.value))}
                  className="w-20 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-gray-500 font-medium">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Konten 3 — Tugas</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Dinilai manual oleh guru</p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={k3}
                  onChange={(e) => setK3(Number(e.target.value))}
                  className="w-20 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-gray-500 font-medium">%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-gray-900 dark:text-white">Total Bobot</div>
            <div className="flex items-center space-x-4">
              {isTotalValid ? (
                <span className="flex items-center text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Total sudah tepat 100%
                </span>
              ) : (
                <span className="flex items-center text-red-600 dark:text-red-400 font-medium">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {total < 100 ? `Total kurang ${100 - total}%` : `Total melebihi ${total - 100}%`}
                </span>
              )}
              <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                isTotalValid 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {total}%
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={handleReset}
              className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset ke Default
            </button>
            <button
              onClick={handleSave}
              disabled={!isTotalValid || saving}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Simpan Pengaturan
            </button>
          </div>

        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900/50 p-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Catatan Penilaian:</h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
            <li>Jika modul tidak memiliki item untuk salah satu konten (misal: tidak ada tugas), bobot konten tersebut akan didistribusikan secara proporsional ke konten lainnya saat menghitung nilai akhir.</li>
            <li>Nilai akhir dihitung dengan rumus: <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">(Rata-rata K1 × Bobot K1) + (Rata-rata K2 × Bobot K2) + (Rata-rata K3 × Bobot K3)</code></li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
