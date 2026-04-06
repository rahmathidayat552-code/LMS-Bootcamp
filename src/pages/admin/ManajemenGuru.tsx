import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { Search, Trash2, User, Phone, Mail, Briefcase, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  uid: string;
  email: string;
  nama_lengkap: string;
  role: string;
  no_wa?: string;
  foto_url?: string;
  username?: string; // NIP
}

export default function ManajemenGuru() {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState({
    nama_lengkap: '',
    username: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'GURU')));
      const teachersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setTeachers(teachersData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (uid: string) => {
    if (window.confirm('Apakah Anda yakin untuk menghapus data ini?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        setTeachers(teachers.filter(t => t.uid !== uid));
        toast.success('Akun guru berhasil dihapus');
      } catch (error) {
        toast.error('Gagal menghapus akun');
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.username && t.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleInlineEditStart = (teacher: UserProfile) => {
    setInlineEditingId(teacher.uid);
    setInlineEditData({
      nama_lengkap: teacher.nama_lengkap,
      username: teacher.username || ''
    });
  };

  const handleInlineEditCancel = () => {
    setInlineEditingId(null);
  };

  const handleInlineEditSave = async (uid: string) => {
    try {
      setLoading(true);
      const teacher = teachers.find(t => t.uid === uid);
      if (!teacher) return;

      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        nama_lengkap: inlineEditData.nama_lengkap,
        username: inlineEditData.username
      });

      // Update master_users
      if (teacher.username) {
        const oldMasterRef = doc(db, 'master_users', teacher.username);
        const oldMasterDoc = await getDoc(oldMasterRef);
        
        if (oldMasterDoc.exists()) {
          if (teacher.username !== inlineEditData.username && inlineEditData.username) {
            // NIP changed, create new doc and delete old
            const newMasterRef = doc(db, 'master_users', inlineEditData.username);
            await setDoc(newMasterRef, {
              ...oldMasterDoc.data(),
              nama_lengkap: inlineEditData.nama_lengkap,
              username: inlineEditData.username
            });
            await deleteDoc(oldMasterRef);
          } else {
            // Just update
            await updateDoc(oldMasterRef, {
              nama_lengkap: inlineEditData.nama_lengkap
            });
          }
        }
      } else if (inlineEditData.username) {
        // If they didn't have a username before but now they do
        const newMasterRef = doc(db, 'master_users', inlineEditData.username);
        await setDoc(newMasterRef, {
          nama_lengkap: inlineEditData.nama_lengkap,
          username: inlineEditData.username,
          role: 'GURU',
          password: inlineEditData.username // Default password
        });
      }

      toast.success('Berhasil update data pengguna!');
      setInlineEditingId(null);
      fetchData();
    } catch (error) {
      console.error('Error updating teacher:', error);
      toast.error('Gagal memperbarui data guru');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Guru</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola akun guru yang telah terdaftar di sistem.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama, email, atau NIP..."
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
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Guru</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kontak</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">NIP</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Memuat data...</td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Tidak ada guru ditemukan.</td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => (
                  inlineEditingId === teacher.uid ? (
                    <tr key={teacher.uid} className="bg-blue-50/50 dark:bg-blue-900/10 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                            {teacher.foto_url ? (
                              <img src={teacher.foto_url} alt="" className="w-full h-full object-cover" />
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
                              {teacher.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          {teacher.no_wa || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-2 min-w-[120px]">
                          <input
                            type="text"
                            value={inlineEditData.username}
                            onChange={(e) => setInlineEditData({...inlineEditData, username: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="NIP"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleInlineEditSave(teacher.uid)}
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
                  <tr key={teacher.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                          {teacher.foto_url ? (
                            <img src={teacher.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <User className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{teacher.nama_lengkap}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1" />
                            {teacher.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        {teacher.no_wa || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <Briefcase className="w-4 h-4 mr-2 text-purple-500" />
                        {teacher.username || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => handleInlineEditStart(teacher)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Edit Data"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(teacher.uid)}
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
    </div>
  );
}
