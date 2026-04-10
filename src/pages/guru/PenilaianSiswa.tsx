import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Search, Filter, FileDown } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSettings } from '../../contexts/SettingsContext';

interface SiswaData {
  id: string;
  nama_lengkap: string;
  kelas_id: string;
  kelas_nama: string;
  tanggal_selesai: any;
  nilai_akhir: number | null;
  status: 'Sudah Dinilai' | 'Menunggu';
}

export default function PenilaianSiswa() {
  const { modulId } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [modul, setModul] = useState<any>(null);
  const [guruNama, setGuruNama] = useState<string>('');
  const [siswaList, setSiswaList] = useState<SiswaData[]>([]);
  const [filteredSiswa, setFilteredSiswa] = useState<SiswaData[]>([]);
  const [kelasOptions, setKelasOptions] = useState<{id: string, nama: string}[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!modulId) return;

    const fetchData = async () => {
      try {
        // 1. Get Modul
        const modulDoc = await getDoc(doc(db, 'moduls', modulId));
        if (!modulDoc.exists()) {
          navigate('/guru/penilaian');
          return;
        }
        const modulData = modulDoc.data();
        setModul({ id: modulDoc.id, ...modulData });

        // Get Guru Name
        if (modulData.guru_id) {
          const guruDoc = await getDoc(doc(db, 'users', modulData.guru_id));
          if (guruDoc.exists()) {
            setGuruNama(guruDoc.data().nama_lengkap);
          }
        }

        // 2. Get Modul Items to know total items and types
        const itemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', modulId));
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        const totalItems = items.length;
        const tugasItems = items.filter(i => i.tipe_item === 'TUGAS');

        // 3. Get Penilaian Settings
        const settingsDoc = await getDoc(doc(db, 'penilaian_settings', modulId));
        let bobot = { k1: 20, k2: 30, k3: 50 };
        if (settingsDoc.exists()) {
          const s = settingsDoc.data();
          bobot = { k1: s.bobot_konten1, k2: s.bobot_konten2, k3: s.bobot_konten3 };
        }

        // Normalize bobot if some items don't exist
        const hasK1 = items.some(i => ['MATERI', 'PDF', 'YOUTUBE'].includes(i.tipe_item));
        const hasK2 = items.some(i => i.tipe_item === 'KUIS');
        const hasK3 = tugasItems.length > 0;

        let w1 = hasK1 ? bobot.k1 : 0;
        let w2 = hasK2 ? bobot.k2 : 0;
        let w3 = hasK3 ? bobot.k3 : 0;
        const totalW = w1 + w2 + w3;
        if (totalW > 0 && totalW < 100) {
          w1 = (w1 / totalW) * 100;
          w2 = (w2 / totalW) * 100;
          w3 = (w3 / totalW) * 100;
        }

        // 4. Get Kelas Map
        const kelasSnapshot = await getDocs(collection(db, 'kelas'));
        const kelasMap: Record<string, string> = {};
        kelasSnapshot.docs.forEach(d => {
          kelasMap[d.id] = d.data().nama_kelas;
        });

        // 5. Get Users (Siswa) Map
        const usersQuery = query(collection(db, 'users'), where('role', '==', 'SISWA'));
        const usersSnapshot = await getDocs(usersQuery);
        const usersMap: Record<string, any> = {};
        usersSnapshot.docs.forEach(d => {
          usersMap[d.id] = d.data();
        });

        // 6. Setup real-time listener for progress
        const progressQuery = query(collection(db, 'progres_siswa'), where('modul_id', '==', modulId));
        const unsub = onSnapshot(progressQuery, (progressSnapshot) => {
          const studentProgress: Record<string, any[]> = {};
          progressSnapshot.docs.forEach(d => {
            const data = d.data();
            if (!studentProgress[data.siswa_id]) studentProgress[data.siswa_id] = [];
            studentProgress[data.siswa_id].push(data);
          });

          const completedSiswa: SiswaData[] = [];
          const availableKelas = new Set<string>();

          Object.entries(studentProgress).forEach(([siswaId, progressList]) => {
            const completedItems = progressList.filter(p => p.status_selesai);
            
            // Check if student completed ALL items
            if (completedItems.length >= totalItems && totalItems > 0) {
              const user = usersMap[siswaId];
              if (!user) return;

              // Calculate Grades
              let sumK1 = 0, countK1 = 0;
              let sumK2 = 0, countK2 = 0;
              let sumK3 = 0, countK3 = 0;
              let allTugasGraded = true;

              items.forEach(item => {
                const p = progressList.find(prog => prog.modul_item_id === item.id);
                if (!p) return;

                if (['MATERI', 'PDF', 'YOUTUBE'].includes(item.tipe_item)) {
                  sumK1 += p.status_selesai ? 10 : 0;
                  countK1++;
                } else if (item.tipe_item === 'KUIS') {
                  // Assuming nilai is stored in progress for KUIS
                  sumK2 += p.nilai || 0;
                  countK2++;
                } else if (item.tipe_item === 'TUGAS') {
                  if (p.nilai !== undefined && p.nilai !== null) {
                    sumK3 += p.nilai;
                  } else {
                    allTugasGraded = false;
                  }
                  countK3++;
                }
              });

              const rataK1 = countK1 > 0 ? sumK1 / countK1 : 0;
              const rataK2 = countK2 > 0 ? sumK2 / countK2 : 0;
              const rataK3 = countK3 > 0 ? sumK3 / countK3 : 0;

              let finalGrade: number | null = null;
              if (allTugasGraded) {
                finalGrade = (rataK1 * (w1/100)) + (rataK2 * (w2/100)) + (rataK3 * (w3/100));
              }

              // Find latest completion date
              const latestDate = progressList.reduce((latest, current) => {
                const d1 = latest?.updated_at?.toDate?.() || new Date(0);
                const d2 = current?.updated_at?.toDate?.() || new Date(0);
                return d1 > d2 ? latest : current;
              }, progressList[0])?.updated_at;

              availableKelas.add(user.kelas_id);

              completedSiswa.push({
                id: siswaId,
                nama_lengkap: user.nama_lengkap,
                kelas_id: user.kelas_id,
                kelas_nama: kelasMap[user.kelas_id] || 'Unknown',
                tanggal_selesai: latestDate,
                nilai_akhir: finalGrade,
                status: allTugasGraded ? 'Sudah Dinilai' : 'Menunggu'
              });
            }
          });

          setSiswaList(completedSiswa);
          
          // Update Kelas Options based on students who actually completed
          const kOptions = Array.from(availableKelas).map(kId => ({
            id: kId,
            nama: kelasMap[kId] || 'Unknown'
          }));
          setKelasOptions(kOptions);
          setLoading(false);
        });

        return () => unsub();

      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [modulId, navigate]);

  useEffect(() => {
    let result = siswaList;
    if (selectedKelas !== 'all') {
      result = result.filter(s => s.kelas_id === selectedKelas);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.nama_lengkap.toLowerCase().includes(q));
    }
    // Sort by name
    result.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
    setFilteredSiswa(result);
  }, [siswaList, selectedKelas, searchQuery]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    if (settings?.logoUrl) {
      try {
        doc.addImage(settings.logoUrl, 'PNG', 14, 10, 20, 20);
      } catch (e) {
        console.error('Error adding logo to PDF:', e);
      }
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Laporan Penilaian Modul', settings?.logoUrl ? 40 : 14, 18);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Judul Modul: ${modul?.judul_modul || '-'}`, settings?.logoUrl ? 40 : 14, 25);
    doc.text(`Mata Pelajaran: ${modul?.mata_pelajaran || '-'}`, settings?.logoUrl ? 40 : 14, 31);
    doc.text(`Guru: ${guruNama || '-'}`, settings?.logoUrl ? 40 : 14, 37);

    // Line separator
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    // Table Data
    const tableData = filteredSiswa.map((siswa, index) => [
      index + 1,
      siswa.nama_lengkap,
      siswa.kelas_nama,
      siswa.tanggal_selesai ? format(siswa.tanggal_selesai.toDate(), 'dd MMM yyyy, HH:mm', { locale: idLocale }) : '-',
      siswa.nilai_akhir !== null ? Math.round(siswa.nilai_akhir).toString() : '-',
      siswa.status
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['No', 'Nama Siswa', 'Kelas', 'Tanggal Selesai', 'Nilai Akhir', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Blue-500
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30 }
      }
    });

    const filename = `Penilaian_${modul?.judul_modul?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'modul'}.pdf`;
    doc.save(filename);
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
      className="max-w-6xl mx-auto space-y-6"
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
          <li className="text-gray-900 dark:text-white font-medium truncate max-w-[200px] md:max-w-md">
            {modul?.judul_modul}
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{modul?.judul_modul}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Daftar siswa yang telah menyelesaikan modul</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={handleExportPDF}
              disabled={filteredSiswa.length === 0}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </button>
            <div className="relative flex items-center">
              <Filter className="absolute left-3 w-4 h-4 text-gray-500" />
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="w-full sm:w-auto pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm appearance-none"
              >
                <option value="all">Semua Kelas</option>
                {kelasOptions.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Siswa</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kelas</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal Selesai</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Nilai Akhir</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSiswa.length > 0 ? (
                filteredSiswa.map((siswa, index) => (
                  <tr key={siswa.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{siswa.nama_lengkap}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{siswa.kelas_nama}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {siswa.tanggal_selesai ? format(siswa.tanggal_selesai.toDate(), 'dd MMM yyyy, HH:mm', { locale: idLocale }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {siswa.nilai_akhir !== null ? (
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-bold ${
                          siswa.nilai_akhir >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          siswa.nilai_akhir >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {Math.round(siswa.nilai_akhir)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {siswa.status === 'Sudah Dinilai' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Sudah Dinilai
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Menunggu
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/guru/penilaian/${modulId}/${siswa.id}`)}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Belum ada siswa yang menyelesaikan modul ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
