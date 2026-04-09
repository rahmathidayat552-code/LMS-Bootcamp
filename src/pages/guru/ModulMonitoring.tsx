import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowLeft, Users, CheckCircle, Clock, Activity, FileDown, Filter, Search, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SiswaProgress {
  id: string;
  nama_lengkap: string;
  kelas_id: string;
  kelas_name?: string;
  completedItems: number;
  totalItems: number;
  lastActive: string;
  status: 'Belum Mulai' | 'Sedang Mengerjakan' | 'Selesai';
  score: number;
}

interface Kelas {
  id: string;
  tingkat: string;
  nama_kelas: string;
}

export default function ModulMonitoring() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [modul, setModul] = useState<any>(null);
  const [studentsProgress, setStudentsProgress] = useState<SiswaProgress[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters and Sorting
  const [filterKelas, setFilterKelas] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof SiswaProgress, direction: 'asc' | 'desc' } | null>(null);

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

        // 2. Get Kelas List
        const kelasSnap = await getDocs(collection(db, 'kelas'));
        const kelasData = kelasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Kelas));
        setKelasList(kelasData);
        const kelasMap = kelasData.reduce((acc, k) => ({ ...acc, [k.id]: `${k.tingkat} ${k.nama_kelas}` }), {} as Record<string, string>);

        // 3. Get Total Items in Modul
        const itemsSnap = await getDocs(query(collection(db, 'modul_items'), where('modul_id', '==', id)));
        const totalItems = itemsSnap.size;

        // 4. Get All Students
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'SISWA')));
        const allStudents = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 5. Listen to Progress Realtime
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
              kelas_name: (student as any).kelas_id ? kelasMap[(student as any).kelas_id] : 'Tanpa Kelas',
              completedItems,
              totalItems,
              lastActive,
              status,
              score: totalScore
            };
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

  const filteredAndSortedData = useMemo(() => {
    let data = [...studentsProgress];

    // Search
    if (searchTerm) {
      data = data.filter(s => s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Filter Kelas
    if (filterKelas !== 'all') {
      data = data.filter(s => s.kelas_id === filterKelas);
    }

    // Filter Status
    if (filterStatus !== 'all') {
      data = data.filter(s => s.status === filterStatus);
    }

    // Sort
    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by status
      data.sort((a, b) => {
        const order = { 'Sedang Mengerjakan': 1, 'Selesai': 2, 'Belum Mulai': 3 };
        return order[a.status] - order[b.status];
      });
    }

    return data;
  }, [studentsProgress, searchTerm, filterKelas, filterStatus, sortConfig]);

  const handleSort = (key: keyof SiswaProgress) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header with Logo
    if (settings.logoUrl) {
      try {
        // We need to convert image to base64 or use a proxy if it's cross-origin
        // For simplicity, let's try to add it directly if it's a data URL or same origin
        // If it's a remote URL, we might need to fetch it first
        const img = new Image();
        img.src = settings.logoUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue anyway if logo fails
        });
        if (img.complete && img.naturalWidth > 0) {
          doc.addImage(img, 'PNG', 10, 10, 20, 20);
        }
      } catch (e) {
        console.error("Failed to add logo to PDF", e);
      }
    }

    doc.setFontSize(18);
    doc.text('Laporan Progres Belajar Siswa', settings.logoUrl ? 35 : 10, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, settings.logoUrl ? 35 : 10, 26);

    doc.setDrawColor(200);
    doc.line(10, 35, pageWidth - 10, 35);

    // Module Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Modul: ${modul?.judul_modul}`, 10, 45);
    doc.text(`Mata Pelajaran: ${modul?.mata_pelajaran}`, 10, 52);
    doc.text(`Guru Pengampu: ${profile?.nama_lengkap}`, 10, 59);

    // Table
    const tableData = filteredAndSortedData.map((s, index) => [
      index + 1,
      s.nama_lengkap,
      s.kelas_name || '-',
      s.status,
      `${s.completedItems}/${s.totalItems}`,
      s.score > 0 ? s.score : '-',
      s.lastActive ? new Date(s.lastActive).toLocaleString('id-ID') : '-'
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['No', 'Nama Siswa', 'Kelas', 'Status', 'Progres', 'Nilai', 'Aktivitas Terakhir']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { cellWidth: 15 },
        6: { cellWidth: 40 },
      }
    });

    doc.save(`Monitoring_${modul?.judul_modul}_${new Date().getTime()}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        <button
          onClick={exportToPDF}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <FileDown className="w-5 h-5 mr-2" />
          Export PDF
        </button>
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

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari nama siswa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="text-gray-400 w-5 h-5" />
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
          >
            <option value="all">Semua Kelas</option>
            {kelasList.map(k => (
              <option key={k.id} value={k.id}>{k.tingkat} {k.nama_kelas}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="Belum Mulai">Belum Mulai</option>
            <option value="Sedang Mengerjakan">Sedang Mengerjakan</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('nama_lengkap')}
                >
                  <div className="flex items-center">
                    Siswa <ArrowUpDown className="w-3 h-3 ml-1" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('completedItems')}
                >
                  <div className="flex items-center">
                    Progres <ArrowUpDown className="w-3 h-3 ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('score')}
                >
                  <div className="flex items-center">
                    Total Nilai <ArrowUpDown className="w-3 h-3 ml-1" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleSort('lastActive')}
                >
                  <div className="flex items-center">
                    Aktivitas Terakhir <ArrowUpDown className="w-3 h-3 ml-1" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedData.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{student.nama_lengkap}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{student.kelas_name}</div>
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
              {filteredAndSortedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Data tidak ditemukan.
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
