import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import * as XLSX from 'xlsx';
import { Upload, Plus, Trash2, Search, Edit2, X, Download, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Kelas {
  id: string;
  nama_kelas: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // View state: 'list' | 'form' | 'preview'
  const [view, setView] = useState<'list' | 'form' | 'preview'>('list');
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    nama_lengkap: '',
    role: 'SISWA',
    username: '',
    kelas_id: ''
  });

  const fetchData = async () => {
    try {
      const [usersSnapshot, kelasSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'kelas'))
      ]);
      
      const usersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const kelasData = kelasSnapshot.docs.map(doc => ({ id: doc.id, nama_kelas: doc.data().nama_kelas }));
      
      setUsers(usersData);
      setKelasList(kelasData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users/kelas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        email: 'siswa1@sekolah.id',
        nama_lengkap: 'Budi Santoso',
        role: 'SISWA',
        username: '1234567890',
        kelas_id: 'ID_KELAS_DARI_TABEL_KELAS'
      },
      {
        email: 'guru1@sekolah.id',
        nama_lengkap: 'Siti Aminah, S.Pd',
        role: 'GURU',
        username: '198001012005012001',
        kelas_id: ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // email
      { wch: 30 }, // nama_lengkap
      { wch: 10 }, // role
      { wch: 20 }, // username
      { wch: 30 }  // kelas_id
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Pengguna');
    
    XLSX.writeFile(wb, 'Template_Import_Pengguna.xlsx');
  };

  const handleOpenForm = (user?: UserProfile) => {
    if (user) {
      setEditingId(user.uid);
      setFormData({
        email: user.email,
        nama_lengkap: user.nama_lengkap,
        role: user.role,
        username: user.username || '',
        kelas_id: user.kelas_id || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        email: '',
        nama_lengkap: '',
        role: 'SISWA',
        username: '',
        kelas_id: ''
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
      const userData = {
        email: formData.email.toLowerCase(),
        nama_lengkap: formData.nama_lengkap,
        role: formData.role,
        username: formData.username,
        kelas_id: formData.role === 'SISWA' ? formData.kelas_id : '',
        created_at: new Date().toISOString()
      };

      // Use email as ID for new users so they can be matched on login
      const docId = editingId || formData.email.toLowerCase();
      
      await setDoc(doc(db, 'users', docId), userData, { merge: true });
      
      toast.success(editingId ? 'Pengguna berhasil diperbarui!' : 'Pengguna berhasil ditambahkan!');
      handleCloseForm();
      fetchData();
    } catch (error) {
      toast.error('Terjadi kesalahan saat menyimpan data');
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'users');
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
      if (row.email && row.nama_lengkap && row.role) {
        try {
          const newDocRef = doc(db, 'users', row.email.toLowerCase());
          await setDoc(newDocRef, {
            email: row.email.toLowerCase(),
            nama_lengkap: row.nama_lengkap,
            role: row.role.toUpperCase(),
            username: row.username || '',
            kelas_id: row.kelas_id || '',
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
      toast.success(`${successCount} pengguna berhasil diimpor!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} baris gagal diimpor karena data tidak valid.`);
    }

    setView('list');
    setPreviewData([]);
    fetchData();
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('Yakin ingin menghapus pengguna ini?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        setUsers(users.filter(u => u.uid !== uid));
        toast.success('Pengguna berhasil dihapus!');
      } catch (error) {
        toast.error('Gagal menghapus pengguna');
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getKelasName = (kelasId?: string) => {
    if (!kelasId) return '-';
    const kelas = kelasList.find(k => k.id === kelasId);
    return kelas ? kelas.nama_kelas : '-';
  };

  if (view === 'form') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {editingId ? 'Edit Pengguna' : 'Tambah Pengguna'}
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
                Email (Wajib, akun Google)
              </label>
              <input
                type="email"
                required
                disabled={!!editingId}
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                placeholder="email@sekolah.id"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={formData.nama_lengkap}
                onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nama lengkap pengguna"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="SISWA">Siswa</option>
                  <option value="GURU">Guru</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NISN / NIP
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Opsional"
                />
              </div>
            </div>

            {formData.role === 'SISWA' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kelas
                </label>
                <select
                  value={formData.kelas_id}
                  onChange={(e) => setFormData({...formData, kelas_id: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map(kelas => (
                    <option key={kelas.id} value={kelas.id}>{kelas.nama_kelas}</option>
                  ))}
                </select>
              </div>
            )}

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
                Simpan Pengguna
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preview Import Data</h1>
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

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Lengkap</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">NISN/NIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {previewData.map((row, index) => {
                  const isValid = row.email && row.nama_lengkap && ['ADMIN', 'GURU', 'SISWA'].includes(row.role?.toUpperCase());
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
                        {row.nama_lengkap || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.email || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.role || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.username || '-'}
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Pengguna</h1>
        
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
              placeholder="Cari nama, email, NISN/NIP, atau role..."
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
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama & Identitas</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kontak</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role & Kelas</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Memuat data...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Tidak ada pengguna ditemukan.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">{user.nama_lengkap}</div>
                      {user.username && <div className="text-xs text-gray-500 dark:text-gray-400">ID: {user.username}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit
                          ${user.role === 'ADMIN' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 
                            user.role === 'GURU' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {user.role}
                        </span>
                        {user.role === 'SISWA' && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Kelas: {getKelasName(user.kelas_id)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button onClick={() => handleOpenForm(user)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(user.uid)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
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
