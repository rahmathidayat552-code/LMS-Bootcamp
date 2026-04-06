import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { formatFullDate } from '../../utils/dateUtils';
import * as XLSX from 'xlsx';
import { Upload, Plus, Trash2, Search, Edit2, X, Download, ArrowLeft, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArrowUpDown, FileText } from 'lucide-react';

interface Kelas {
  id: string;
  nama_kelas: string;
}

export interface MasterUser {
  id: string;
  nama_lengkap: string;
  role: 'ADMIN' | 'GURU' | 'SISWA';
  username: string; // NISN/NIP
  tanggal_lahir: string; // YYYY-MM-DD
  kelas_id?: string;
  is_registered?: boolean;
}

export default function Users() {
  const [users, setUsers] = useState<MasterUser[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importRole, setImportRole] = useState<'GURU' | 'SISWA'>('SISWA');
  const [importKelasId, setImportKelasId] = useState('');
  const [showImportSuccess, setShowImportSuccess] = useState(false);

  const [filterRole, setFilterRole] = useState('');
  const [filterKelasId, setFilterKelasId] = useState('');
  const [sortBy, setSortBy] = useState<'nama_lengkap' | 'username'>('nama_lengkap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // View state: 'list' | 'form' | 'preview' | 'import'
  const [view, setView] = useState<'list' | 'form' | 'preview' | 'import'>('list');
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    role: 'SISWA',
    username: '',
    tanggal_lahir: '',
    kelas_id: ''
  });

  const fetchData = async () => {
    try {
      const [usersSnapshot, kelasSnapshot] = await Promise.all([
        getDocs(collection(db, 'master_users')),
        getDocs(collection(db, 'kelas'))
      ]);
      
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterUser));
      const kelasData = kelasSnapshot.docs.map(doc => ({ id: doc.id, nama_kelas: doc.data().nama_kelas }));
      
      setUsers(usersData);
      setKelasList(kelasData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'master_users/kelas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadTemplate = () => {
    let templateData;
    let fileName;
    if (importRole === 'GURU') {
      templateData = [{
        'NIP': '198001012005012001',
        'Nama Lengkap': 'Siti Aminah, S.Pd',
        'Tanggal Lahir (YYYY-MM-DD)': '1980-01-01'
      }];
      fileName = 'Template_Guru.xlsx';
    } else {
      templateData = [{
        'NISN': '1234567890',
        'Nama Lengkap': 'Budi Santoso',
        'Tanggal Lahir (YYYY-MM-DD)': '2005-08-17'
      }];
      fileName = 'Template_Siswa.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, fileName);
  };

  const handleOpenForm = (user?: MasterUser) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        nama_lengkap: user.nama_lengkap,
        role: user.role,
        username: user.username,
        tanggal_lahir: user.tanggal_lahir || '',
        kelas_id: user.kelas_id || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        nama_lengkap: '',
        role: 'SISWA',
        username: '',
        tanggal_lahir: '',
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
      if (!formData.username) {
        toast.error('NISN/NIP wajib diisi!');
        return;
      }

      const userData = {
        nama_lengkap: formData.nama_lengkap,
        role: formData.role,
        username: formData.username,
        tanggal_lahir: formData.tanggal_lahir,
        kelas_id: formData.role === 'SISWA' ? formData.kelas_id : '',
        created_at: new Date().toISOString(), // Keep ISO string for DB, but we can use dateUtils for display
        is_registered: editingId ? (users.find(u => u.id === editingId)?.is_registered || false) : false
      };

      if (editingId && editingId !== formData.username) {
        // Username (NISN/NIP) has changed
        // 1. Check if new username already exists
        const newDocRef = doc(db, 'master_users', formData.username);
        const newDocSnap = await getDoc(newDocRef);
        if (newDocSnap.exists()) {
          toast.error('NISN/NIP sudah digunakan oleh pengguna lain!');
          return;
        }

        // 2. Create new document
        await setDoc(newDocRef, userData);

        // 3. Delete old document
        await deleteDoc(doc(db, 'master_users', editingId));

        // 4. Update in 'users' collection if registered
        const existingUser = users.find(u => u.id === editingId);
        if (existingUser?.is_registered) {
          const usersQuery = query(collection(db, 'users'), where('username', '==', editingId));
          const usersSnapshot = await getDocs(usersQuery);
          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            await updateDoc(doc(db, 'users', userDoc.id), {
              username: formData.username,
              role: formData.role,
              kelas_id: formData.role === 'SISWA' ? formData.kelas_id : ''
            });
          }
        }
      } else {
        // Normal update or create
        const docId = editingId || formData.username;
        await setDoc(doc(db, 'master_users', docId), userData, { merge: true });
        
        // Sinkronkan kelas_id dan role ke collection 'users' jika sudah terdaftar
        if (editingId) {
          const existingUser = users.find(u => u.id === editingId);
          if (existingUser?.is_registered) {
            // Cari user di collection 'users' berdasarkan username
            const usersQuery = query(collection(db, 'users'), where('username', '==', formData.username));
            const usersSnapshot = await getDocs(usersQuery);
            if (!usersSnapshot.empty) {
              const userDoc = usersSnapshot.docs[0];
              await updateDoc(doc(db, 'users', userDoc.id), {
                role: formData.role,
                kelas_id: formData.role === 'SISWA' ? formData.kelas_id : ''
              });
            }
          }
        }
      }
      
      toast.success(editingId ? 'Berhasil update data pengguna!' : 'Berhasil tambah data pengguna!');
      handleCloseForm();
      fetchData();
    } catch (error) {
      toast.error('Terjadi kesalahan saat menyimpan data');
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'master_users');
    }
  };

  const executeImport = async (dataToImport: any[]) => {
    setIsImporting(true);
    setImportProgress(0);
    setImportTotal(dataToImport.length);
    
    let successCount = 0;
    let errorCount = 0;
    const newUsers: MasterUser[] = [];

    for (let i = 0; i < dataToImport.length; i++) {
      const row = dataToImport[i];
      if (row.username && row.nama_lengkap && row.role && row.tanggal_lahir) {
        try {
          const docId = String(row.username);
          const docRef = doc(db, 'master_users', docId);
          const docSnap = await getDoc(docRef);
          
          const updateData: any = {
            username: docId,
            nama_lengkap: row.nama_lengkap,
            role: row.role.toUpperCase(),
            tanggal_lahir: row.tanggal_lahir,
          };
          if (row.kelas_id) updateData.kelas_id = row.kelas_id;

          let isRegistered = false;
          if (!docSnap.exists()) {
            const newDoc = { ...updateData, is_registered: false, created_at: new Date().toISOString() };
            await setDoc(docRef, newDoc);
            newUsers.push({ id: docId, ...newDoc } as MasterUser);
          } else {
            isRegistered = docSnap.data().is_registered || false;
            await setDoc(docRef, updateData, { merge: true });
            newUsers.push({ id: docId, ...docSnap.data(), ...updateData } as MasterUser);
          }

          // Sync to users collection if registered
          if (isRegistered && updateData.role === 'SISWA' && updateData.kelas_id) {
            const usersQuery = query(collection(db, 'users'), where('username', '==', docId));
            const usersSnapshot = await getDocs(usersQuery);
            if (!usersSnapshot.empty) {
              const userDoc = usersSnapshot.docs[0];
              await updateDoc(doc(db, 'users', userDoc.id), {
                kelas_id: updateData.kelas_id
              });
            }
          }

          successCount++;
        } catch (error) {
          errorCount++;
        }
      } else {
        errorCount++;
      }
      setImportProgress(i + 1);
      
      // Memberikan jeda singkat agar browser dapat me-render animasi progress bar dengan mulus
      if (i % 2 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    if (successCount > 0) {
      setShowImportSuccess(true);
      setTimeout(() => setShowImportSuccess(false), 3000);
      
      setUsers(prevUsers => {
        const updatedUsers = [...prevUsers];
        newUsers.forEach(newUser => {
          const index = updatedUsers.findIndex(u => u.id === newUser.id);
          if (index !== -1) {
            updatedUsers[index] = newUser;
          } else {
            updatedUsers.push(newUser);
          }
        });
        return updatedUsers;
      });
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} baris gagal diimpor karena data tidak valid.`);
    }

    setIsImporting(false);
    setView('list');
    setPreviewData([]);
  };

  const handleConfirmImport = () => executeImport(previewData);

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
        
        const mappedData = data.map(row => {
          const username = importRole === 'GURU' ? (row.NIP || row.nip || row.Nip) : (row.NISN || row.nisn || row.Nisn);
          return {
            username: String(username || '').trim(),
            nama_lengkap: String(row['Nama Lengkap'] || row.nama_lengkap || row.nama || '').trim(),
            tanggal_lahir: String(row['Tanggal Lahir (YYYY-MM-DD)'] || row.tanggal_lahir || '').trim(),
            role: importRole,
            kelas_id: importRole === 'SISWA' ? importKelasId : ''
          };
        });

        const allValid = mappedData.length > 0 && mappedData.every(r => r.username && r.nama_lengkap && r.tanggal_lahir);

        if (allValid) {
          await executeImport(mappedData);
        } else {
          setPreviewData(mappedData);
          setView('preview');
        }
      } catch (error) {
        console.error("Error importing data:", error);
        toast.error('Gagal membaca file Excel. Pastikan format benar.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin untuk menghapus data ini?')) {
      try {
        await deleteDoc(doc(db, 'master_users', id));
        setUsers(users.filter(u => u.id !== id));
        toast.success('Data induk berhasil dihapus!');
      } catch (error) {
        toast.error('Gagal menghapus data induk');
        handleFirestoreError(error, OperationType.DELETE, `master_users/${id}`);
      }
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["No", "Nama Lengkap", "NISN/NIP", "Role", "Kelas", "Tgl Lahir"];
    const tableRows: any[] = [];

    filteredUsers.forEach((user, index) => {
      const userData = [
        index + 1,
        user.nama_lengkap,
        user.username,
        user.role,
        getKelasName(user.kelas_id),
        user.tanggal_lahir
      ];
      tableRows.push(userData);
    });

    doc.setFontSize(18);
    doc.text("Data Induk Pengguna", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    
    let filterText = `Filter Role: ${filterRole || "Semua"}`;
    if (filterKelasId) filterText += ` | Kelas: ${getKelasName(filterKelasId)}`;
    
    doc.text(filterText, 14, 30);
    doc.text(`Total Pengguna: ${filteredUsers.length}`, 14, 35);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 40);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`Data_Induk_${new Date().getTime()}.pdf`);
    toast.success('Berhasil mengekspor data ke PDF!');
  };

  const filteredUsers = users
    .filter(u => {
      const matchesSearch = 
        u.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = filterRole ? u.role === filterRole : true;
      const matchesKelas = filterKelasId ? u.kelas_id === filterKelasId : true;
      
      return matchesSearch && matchesRole && matchesKelas;
    })
    .sort((a, b) => {
      let valA = '';
      let valB = '';
      
      if (sortBy === 'nama_lengkap') {
        valA = a.nama_lengkap.toLowerCase();
        valB = b.nama_lengkap.toLowerCase();
      } else if (sortBy === 'username') {
        valA = a.username.toLowerCase();
        valB = b.username.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return valA.localeCompare(valB);
      } else {
        return valB.localeCompare(valA);
      }
    });

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
            {editingId ? 'Edit Data Induk' : 'Tambah Data Induk'}
          </h1>
          <button 
            onClick={handleCloseForm}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p><strong>Data Induk</strong> digunakan sebagai referensi saat siswa atau guru melakukan registrasi akun. Pastikan NISN/NIP dan Tanggal Lahir sesuai.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NISN / NIP (Wajib)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="Masukkan NISN atau NIP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Lahir (Wajib)
                </label>
                <input
                  type="date"
                  required
                  value={formData.tanggal_lahir}
                  onChange={(e) => setFormData({...formData, tanggal_lahir: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
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
              
              {formData.role === 'SISWA' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kelas (Wajib untuk Siswa)
                  </label>
                  <select
                    required
                    value={formData.kelas_id}
                    onChange={(e) => setFormData({...formData, kelas_id: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="" disabled>-- Pilih Kelas --</option>
                    {kelasList.map(kelas => (
                      <option key={kelas.id} value={kelas.id}>{kelas.nama_kelas}</option>
                    ))}
                  </select>
                </div>
              )}
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
                Simpan Data Induk
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'import') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Data Induk</h1>
          <button 
            onClick={() => setView('list')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jenis Data yang Diimpor</label>
              <div className="flex space-x-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" checked={importRole === 'SISWA'} onChange={() => setImportRole('SISWA')} className="text-blue-600 focus:ring-blue-500 w-4 h-4" />
                  <span className="text-base dark:text-gray-200">Siswa</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" checked={importRole === 'GURU'} onChange={() => setImportRole('GURU')} className="text-blue-600 focus:ring-blue-500 w-4 h-4" />
                  <span className="text-base dark:text-gray-200">Guru</span>
                </label>
              </div>
            </div>

            {importRole === 'SISWA' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pilih Kelas (Opsional)</label>
                <select
                  value={importKelasId}
                  onChange={(e) => setImportKelasId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Tanpa Kelas (Atur Nanti) --</option>
                  {kelasList.map(kelas => (
                    <option key={kelas.id} value={kelas.id}>{kelas.nama_kelas}</option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2">Jika dipilih, semua siswa dalam file import akan otomatis dimasukkan ke kelas ini.</p>
              </div>
            )}

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
              <button onClick={handleDownloadTemplate} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                <Download className="w-5 h-5" />
                <span>Download Template {importRole === 'SISWA' ? 'Siswa' : 'Guru'}</span>
              </button>
              
              <label className="flex-1 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                <Upload className="w-5 h-5" />
                <span>Pilih File Excel & Import</span>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'preview') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preview Import Data Induk</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Periksa kembali data sebelum mengimpor ke sistem.</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                setView('list');
                setPreviewData([]);
              }}
              disabled={isImporting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button 
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'Mengimpor...' : 'Konfirmasi Import'}</span>
            </button>
          </div>
        </div>

        {isImporting && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Proses Import...</span>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {Math.round((importProgress / importTotal) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${(importProgress / importTotal) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Mengimpor {importProgress} dari {importTotal} data...
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">NISN/NIP</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Lengkap</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tgl Lahir</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {previewData.map((row, index) => {
                  const isValid = row.username && row.nama_lengkap && row.tanggal_lahir && ['ADMIN', 'GURU', 'SISWA'].includes(row.role?.toUpperCase());
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
                        {row.username || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.nama_lengkap || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.tanggal_lahir || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {row.role || <span className="text-red-500 italic">Kosong</span>}
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Induk Pengguna</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola data dasar siswa dan guru untuk keperluan registrasi.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setView('import')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import Data</span>
          </button>
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
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 flex-1">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama, NIP/NISN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Semua Role</option>
                <option value="ADMIN">ADMIN</option>
                <option value="GURU">GURU</option>
                <option value="SISWA">SISWA</option>
              </select>
              {filterRole === 'SISWA' && (
                <select
                  value={filterKelasId}
                  onChange={(e) => setFilterKelasId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                  ))}
                </select>
              )}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (sortBy === 'nama_lengkap') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('nama_lengkap');
                      setSortOrder('asc');
                    }
                  }}
                  className={`px-3 py-2 rounded-lg border transition-colors flex items-center space-x-1 text-sm ${sortBy === 'nama_lengkap' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
                >
                  <span>Nama</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'username') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('username');
                      setSortOrder('asc');
                    }
                  }}
                  className={`px-3 py-2 rounded-lg border transition-colors flex items-center space-x-1 text-sm ${sortBy === 'username' ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
                >
                  <span>NISN/NIP</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={exportToPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama & NISN/NIP</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tgl Lahir</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role & Kelas</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status Akun</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Memuat data...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Tidak ada data ditemukan.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">{user.nama_lengkap}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ID: {user.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {user.tanggal_lahir}
                    </td>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.is_registered ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Terdaftar
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Belum Terdaftar
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button onClick={() => handleOpenForm(user)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
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

      <AnimatePresence>
        {showImportSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999]"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center space-y-4 min-w-[300px]">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-gray-900 dark:text-white font-medium text-lg text-center">
                Data Pengguna Berhasil Diimpor!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
