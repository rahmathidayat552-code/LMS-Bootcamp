import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Edit2, Search, Upload, Download, ArrowLeft, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Kelas {
  id: string;
  nama_kelas: string;
  tingkat: number;
  created_at: string;
}

export default function Kelas() {
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // View state: 'list' | 'form' | 'preview'
  const [view, setView] = useState<'list' | 'form' | 'preview'>('list');
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama_kelas: '',
    tingkat: 10
  });

  const fetchKelas = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'kelas'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kelas));
      // Sort by tingkat then nama_kelas
      data.sort((a, b) => {
        if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat;
        return a.nama_kelas.localeCompare(b.nama_kelas);
      });
      setKelasList(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'kelas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKelas();
  }, []);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        tingkat: 10,
        nama_kelas: '10-RPL-1'
      },
      {
        tingkat: 11,
        nama_kelas: '11-TKJ-2'
      },
      {
        tingkat: 12,
        nama_kelas: '12-AKL-1'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 10 }, // tingkat
      { wch: 20 }, // nama_kelas
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Kelas');
    
    XLSX.writeFile(wb, 'Template_Import_Kelas.xlsx');
  };

  const handleOpenForm = (kelas?: Kelas) => {
    if (kelas) {
      setEditingId(kelas.id);
      setFormData({
        nama_kelas: kelas.nama_kelas,
        tingkat: kelas.tingkat
      });
    } else {
      setEditingId(null);
      setFormData({
        nama_kelas: '',
        tingkat: 10
      });
    }
    setView('form');
  };

  const handleCloseForm = () => {
    setView('list');
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const kelasData = {
        nama_kelas: formData.nama_kelas,
        tingkat: Number(formData.tingkat),
        created_at: new Date().toISOString() // ISO string for DB
      };

      if (editingId) {
        await setDoc(doc(db, 'kelas', editingId), kelasData, { merge: true });
        toast.success('Kelas berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'kelas'), kelasData);
        toast.success('Kelas berhasil ditambahkan!');
      }
      
      handleCloseForm();
      fetchKelas();
    } catch (error) {
      toast.error('Terjadi kesalahan saat menyimpan data');
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'kelas');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        setPreviewData(data);
        setView('preview');
      } catch (error) {
        console.error("Error importing data:", error);
        toast.error('Gagal membaca file Excel. Pastikan format benar.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of previewData) {
      const tingkat = Number(row.tingkat);
      const nama_kelas = row.nama_kelas?.toString().trim();

      if ([10, 11, 12].includes(tingkat) && nama_kelas) {
        try {
          await addDoc(collection(db, 'kelas'), {
            tingkat: tingkat,
            nama_kelas: nama_kelas,
            created_at: new Date().toISOString()
          });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      } else {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} kelas berhasil diimpor!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} baris gagal diimpor karena data tidak valid.`);
    }

    setView('list');
    setPreviewData([]);
    fetchKelas();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus kelas ini? Semua data terkait mungkin akan terpengaruh.')) {
      try {
        await deleteDoc(doc(db, 'kelas', id));
        setKelasList(kelasList.filter(k => k.id !== id));
        toast.success('Kelas berhasil dihapus!');
      } catch (error) {
        toast.error('Gagal menghapus kelas');
        handleFirestoreError(error, OperationType.DELETE, `kelas/${id}`);
      }
    }
  };

  const filteredKelas = kelasList.filter(k => 
    k.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.tingkat.toString().includes(searchTerm)
  );

  if (view === 'form') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {editingId ? 'Edit Kelas' : 'Tambah Kelas'}
          </h1>
          <button 
            onClick={handleCloseForm}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tingkat
              </label>
              <select
                required
                value={formData.tingkat}
                onChange={(e) => setFormData({...formData, tingkat: Number(e.target.value)})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={10}>Kelas 10</option>
                <option value={11}>Kelas 11</option>
                <option value={12}>Kelas 12</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Kelas (Contoh: 10-RPL-1)
              </label>
              <input
                type="text"
                required
                value={formData.nama_kelas}
                onChange={(e) => setFormData({...formData, nama_kelas: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan nama kelas..."
              />
            </div>

            <div className="pt-6 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Simpan Kelas
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'preview') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preview Import Data Kelas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Periksa kembali data sebelum mengimpor ke sistem.</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                setView('list');
                setPreviewData([]);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleConfirmImport}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Konfirmasi Import</span>
            </button>
          </div>
        </div>

        {/* Panduan Import */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">Panduan Import Kelas:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Pastikan kolom <strong>tingkat</strong> hanya berisi angka 10, 11, atau 12.</li>
              <li>Pastikan kolom <strong>nama_kelas</strong> tidak kosong (contoh: 10-RPL-1).</li>
              <li>Baris dengan ikon silang merah (<AlertCircle className="w-3 h-3 inline text-red-500"/>) tidak akan diimpor.</li>
            </ul>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tingkat</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {previewData.map((row, index) => {
                  const tingkat = Number(row.tingkat);
                  const isValid = [10, 11, 12].includes(tingkat) && row.nama_kelas && row.nama_kelas.toString().trim() !== '';
                  return (
                    <tr key={index} className={isValid ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-red-50 dark:bg-red-900/10'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isValid ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {row.tingkat || <span className="text-red-500 italic">Kosong/Salah</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.nama_kelas || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Kelas</h1>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleDownloadTemplate}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Template</span>
          </button>
          <label className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import Excel</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => handleOpenForm()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama kelas atau tingkat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tingkat</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Kelas</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Memuat data...</td>
                </tr>
              ) : filteredKelas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Tidak ada kelas ditemukan.</td>
                </tr>
              ) : (
                filteredKelas.map((kelas) => (
                  <tr key={kelas.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Kelas {kelas.tingkat}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">{kelas.nama_kelas}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button onClick={() => handleOpenForm(kelas)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(kelas.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
