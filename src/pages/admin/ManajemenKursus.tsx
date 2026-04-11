import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { Users, Search, CheckCircle, XCircle } from 'lucide-react';
import { UserProfile } from '../../contexts/AuthContext';

export default function ManajemenKursus() {
  const [gurus, setGurus] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchGurus();
  }, []);

  const fetchGurus = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'GURU'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setGurus(data);
    } catch (error) {
      console.error('Error fetching gurus:', error);
      toast.error('Gagal memuat data guru');
    } finally {
      setLoading(false);
    }
  };

  const toggleTrainerStatus = async (guruId: string, currentStatus: boolean | undefined) => {
    setUpdating(guruId);
    try {
      const newStatus = !currentStatus;
      await updateDoc(doc(db, 'users', guruId), {
        is_trainer: newStatus
      });
      
      setGurus(prev => prev.map(g => 
        g.uid === guruId ? { ...g, is_trainer: newStatus } : g
      ));
      
      toast.success(`Status trainer berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (error) {
      console.error('Error updating trainer status:', error);
      toast.error('Gagal mengubah status trainer');
    } finally {
      setUpdating(null);
    }
  };

  const filteredGurus = gurus.filter(g => 
    g.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Users className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
          Manajemen Trainer Kursus
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Kelola akses guru sebagai trainer untuk Modul Kursus.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari nama atau email guru..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Nama Guru</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium text-center">Status Trainer</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredGurus.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada data guru ditemukan.
                  </td>
                </tr>
              ) : (
                filteredGurus.map((guru) => (
                  <tr key={guru.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {guru.nama_lengkap}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {guru.email}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {guru.is_trainer ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="w-3 h-3 mr-1" /> Trainer
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
                          <XCircle className="w-3 h-3 mr-1" /> Bukan Trainer
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleTrainerStatus(guru.uid, guru.is_trainer)}
                        disabled={updating === guru.uid}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                          guru.is_trainer
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'
                        }`}
                      >
                        {updating === guru.uid ? 'Memproses...' : guru.is_trainer ? 'Cabut Akses' : 'Jadikan Trainer'}
                      </button>
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
