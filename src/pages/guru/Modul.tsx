import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Edit, Trash2, Eye, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Modul {
  id: string;
  judul_modul: string;
  mata_pelajaran: string;
  tipe_target: string;
  is_published: boolean;
  ikon?: string;
  created_at: string;
}

export default function ModulList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [moduls, setModuls] = useState<Modul[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModuls = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'moduls'),
        where('guru_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Modul[];
      
      // Sort in memory since we don't have a composite index yet
      data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      setModuls(data);
    } catch (error) {
      console.error('Error fetching moduls:', error);
      toast.error('Gagal memuat daftar modul');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModuls();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus modul ini?')) {
      try {
        await deleteDoc(doc(db, 'moduls', id));
        toast.success('Modul berhasil dihapus');
        fetchModuls();
      } catch (error) {
        console.error('Error deleting modul:', error);
        toast.error('Gagal menghapus modul');
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Memuat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Modul</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola modul pembelajaran untuk siswa Anda.</p>
        </div>
        <Link
          to="/guru/modul/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Buat Modul</span>
        </Link>
      </div>

      {moduls.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Belum ada modul</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Mulai buat modul pembelajaran pertama Anda.</p>
          <Link
            to="/guru/modul/create"
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Buat Modul Baru</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {moduls.map((modul) => (
            <div key={modul.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
              {modul.ikon && (
                <div className="h-40 w-full overflow-hidden border-b border-gray-200 dark:border-gray-700">
                  <img src={modul.ikon} alt={modul.judul_modul} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    modul.is_published 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {modul.is_published ? 'Dipublikasikan' : 'Draft'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(modul.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {modul.judul_modul}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {modul.mata_pelajaran}
                </p>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Users className="w-4 h-4 mr-1.5" />
                  <span>Target: {modul.tipe_target === 'KELAS' ? 'Kelas' : 'Siswa Tertentu'}</span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
                <Link
                  to={`/guru/modul/${modul.id}`}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Edit Modul"
                >
                  <Edit className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => handleDelete(modul.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Hapus Modul"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
