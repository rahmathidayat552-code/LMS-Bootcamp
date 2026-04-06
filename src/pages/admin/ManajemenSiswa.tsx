import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { Search, Trash2, User, Phone, Mail, BookOpen, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  uid: string;
  email: string;
  nama_lengkap: string;
  role: string;
  kelas_id?: string;
  no_wa?: string;
  foto_url?: string;
  username?: string; // NISN
}

interface Kelas {
  id: string;
  nama_kelas: string;
}

export default function ManajemenSiswa() {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    nama_lengkap: '',
    kelas_id: '',
    no_wa: ''
  });

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditKelasId, setBulkEditKelasId] = useState('');

  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState({
    nama_lengkap: '',
    kelas_id: '',
    username: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersSnapshot, kelasSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'SISWA'))),
        getDocs(collection(db, 'kelas'))
      ]);
      
      const studentsData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const kelasData = kelasSnapshot.docs.map(doc => ({ id: doc.id, nama_kelas: doc.data().nama_kelas } as Kelas));
      
      setStudents(studentsData);
      setKelasList(kelasData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (student: UserProfile) => {
    setEditingStudent(student);
    setEditFormData({
      nama_lengkap: student.nama_lengkap,
      kelas_id: student.kelas_id || '',
      no_wa: student.no_wa || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      setLoading(true);
      const userRef = doc(db, 'users', editingStudent.uid);
      await updateDoc(userRef, {
        nama_lengkap: editFormData.nama_lengkap,
        kelas_id: editFormData.kelas_id,
        no_wa: editFormData.no_wa
      });

      // Also update master_users if username exists
      if (editingStudent.username) {
        const masterRef = doc(db, 'master_users', editingStudent.username);
        const masterDoc = await getDoc(masterRef);
        if (masterDoc.exists()) {
          await updateDoc(masterRef, {
            nama_lengkap: editFormData.nama_lengkap,
            kelas_id: editFormData.kelas_id
          });
        }
      }

      toast.success('Data siswa berhasil diperbarui');
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Gagal memperbarui data siswa');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus akun siswa ini? Tindakan ini tidak dapat dibatalkan.')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        setStudents(students.filter(s => s.uid !== uid));
        toast.success('Akun siswa berhasil dihapus');
      } catch (error) {
        toast.error('Gagal menghapus akun');
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const getKelasName = (kelasId?: string) => {
    if (!kelasId) return '-';
    const kelas = kelasList.find(k => k.id === kelasId);
    return kelas ? kelas.nama_kelas : '-';
  };

  const filteredStudents = students.filter(s => 
    s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.username && s.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudents(filteredStudents.map(s => s.uid));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (uid: string) => {
    setSelectedStudents(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleInlineEditStart = (student: UserProfile) => {
    setInlineEditingId(student.uid);
    setInlineEditData({
      nama_lengkap: student.nama_lengkap,
      kelas_id: student.kelas_id || '',
      username: student.username || ''
    });
  };

  const handleInlineEditCancel = () => {
    setInlineEditingId(null);
  };

  const handleInlineEditSave = async (uid: string) => {
    try {
      setLoading(true);
      const student = students.find(s => s.uid === uid);
      if (!student) return;

      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        nama_lengkap: inlineEditData.nama_lengkap,
        kelas_id: inlineEditData.kelas_id,
        username: inlineEditData.username
      });

      // Update master_users
      if (student.username) {
        const oldMasterRef = doc(db, 'master_users', student.username);
        const oldMasterDoc = await getDoc(oldMasterRef);
        
        if (oldMasterDoc.exists()) {
          if (student.username !== inlineEditData.username && inlineEditData.username) {
            // NISN changed, create new doc and delete old
            const newMasterRef = doc(db, 'master_users', inlineEditData.username);
            await setDoc(newMasterRef, {
              ...oldMasterDoc.data(),
              nama_lengkap: inlineEditData.nama_lengkap,
              kelas_id: inlineEditData.kelas_id,
              username: inlineEditData.username
            });
            await deleteDoc(oldMasterRef);
          } else {
            // Just update
            await updateDoc(oldMasterRef, {
              nama_lengkap: inlineEditData.nama_lengkap,
              kelas_id: inlineEditData.kelas_id
            });
          }
        }
      } else if (inlineEditData.username) {
        // If they didn't have a username before but now they do, we might want to create a master_user
        const newMasterRef = doc(db, 'master_users', inlineEditData.username);
        await setDoc(newMasterRef, {
          nama_lengkap: inlineEditData.nama_lengkap,
          kelas_id: inlineEditData.kelas_id,
          username: inlineEditData.username,
          role: 'SISWA',
          password: inlineEditData.username // Default password
        });
      }

      toast.success('Data siswa berhasil diperbarui');
      setInlineEditingId(null);
      fetchData();
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Gagal memperbarui data siswa');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0 || !bulkEditKelasId) return;

    try {
      setLoading(true);
      
      const updatePromises = selectedStudents.map(async (uid) => {
        const student = students.find(s => s.uid === uid);
        if (!student) return;

        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { kelas_id: bulkEditKelasId });

        if (student.username) {
          const masterRef = doc(db, 'master_users', student.username);
          const masterDoc = await getDoc(masterRef);
          if (masterDoc.exists()) {
            await updateDoc(masterRef, { kelas_id: bulkEditKelasId });
          }
        }
      });

      await Promise.all(updatePromises);

      toast.success(`${selectedStudents.length} data siswa berhasil diperbarui`);
      setIsBulkEditModalOpen(false);
      setSelectedStudents([]);
      setBulkEditKelasId('');
      fetchData();
    } catch (error) {
      console.error('Error bulk updating students:', error);
      toast.error('Gagal memperbarui data siswa secara massal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Siswa</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola akun siswa yang telah terdaftar di sistem.</p>
        </div>
        {selectedStudents.length > 0 && (
          <button
            onClick={() => setIsBulkEditModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span>Edit Kelas ({selectedStudents.length})</span>
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama, email, atau NISN..."
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
                <th className="px-6 py-3 w-12">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Siswa</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kontak</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kelas & NISN</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Memuat data...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Tidak ada siswa ditemukan.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  inlineEditingId === student.uid ? (
                    <tr key={student.uid} className="bg-blue-50/50 dark:bg-blue-900/10 transition-colors">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          disabled
                          className="rounded border-gray-300 text-gray-400 cursor-not-allowed"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                            {student.foto_url ? (
                              <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <User className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-[150px]">
                            <input
                              type="text"
                              value={inlineEditData.nama_lengkap}
                              onChange={(e) => setInlineEditData({...inlineEditData, nama_lengkap: e.target.value})}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Nama Lengkap"
                            />
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                              <Mail className="w-3 h-3 mr-1" />
                              {student.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          {student.no_wa || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-2 min-w-[120px]">
                          <select
                            value={inlineEditData.kelas_id}
                            onChange={(e) => setInlineEditData({...inlineEditData, kelas_id: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Pilih Kelas</option>
                            {kelasList.map(k => (
                              <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={inlineEditData.username}
                            onChange={(e) => setInlineEditData({...inlineEditData, username: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="NISN"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleInlineEditSave(student.uid)}
                            className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 rounded-lg transition-colors"
                            title="Simpan"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={handleInlineEditCancel}
                            className="flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 rounded-lg transition-colors"
                            title="Batal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  <tr key={student.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedStudents.includes(student.uid)}
                        onChange={() => handleSelectStudent(student.uid)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                          {student.foto_url ? (
                            <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <User className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{student.nama_lengkap}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1" />
                            {student.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        {student.no_wa || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <BookOpen className="w-4 h-4 mr-2 text-blue-500" />
                          {getKelasName(student.kelas_id)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          NISN: {student.username || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => handleInlineEditStart(student)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Edit Data"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(student.uid)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Data Siswa</h3>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editFormData.nama_lengkap}
                  onChange={(e) => setEditFormData({ ...editFormData, nama_lengkap: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
                <select
                  value={editFormData.kelas_id}
                  onChange={(e) => setEditFormData({ ...editFormData, kelas_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Pilih Kelas</option>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. WhatsApp</label>
                <input
                  type="text"
                  value={editFormData.no_wa}
                  onChange={(e) => setEditFormData({ ...editFormData, no_wa: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Kelas Massal</h3>
              <p className="text-sm text-gray-500 mt-1">Ubah kelas untuk {selectedStudents.length} siswa terpilih.</p>
            </div>
            <form onSubmit={handleBulkUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pilih Kelas Baru</label>
                <select
                  required
                  value={bulkEditKelasId}
                  onChange={(e) => setBulkEditKelasId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || !bulkEditKelasId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
