import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Edit, Trash2, Eye, Users, Copy, X, Loader2, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../../utils/dateUtils';

interface Modul {
  id: string;
  judul_modul: string;
  mata_pelajaran: string;
  tipe_target: string;
  is_published: boolean;
  is_archived?: boolean;
  ikon?: string;
  created_at: string;
  viewers?: string[];
}

export default function ModulList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [moduls, setModuls] = useState<Modul[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedModulForCopy, setSelectedModulForCopy] = useState<Modul | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedModulForDelete, setSelectedModulForDelete] = useState<Modul | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(false);
  const [hasSubsequent, setHasSubsequent] = useState(false);
  const [copySubsequent, setCopySubsequent] = useState(false);

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

  const handleDeleteClick = (modul: Modul) => {
    setSelectedModulForDelete(modul);
    setDeleteProgress(false); // Default to not deleting progress, or true if preferred
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedModulForDelete) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);

      // 1. Delete all items in this module
      const itemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', selectedModulForDelete.id));
      const itemsSnapshot = await getDocs(itemsQuery);
      itemsSnapshot.docs.forEach(itemDoc => {
        batch.delete(doc(db, 'modul_items', itemDoc.id));
      });

      // 2. Delete student progress if selected
      if (deleteProgress) {
        const progressQuery = query(collection(db, 'progres_siswa'), where('modul_id', '==', selectedModulForDelete.id));
        const progressSnapshot = await getDocs(progressQuery);
        progressSnapshot.docs.forEach(progDoc => {
          batch.delete(doc(db, 'progres_siswa', progDoc.id));
        });
      }

      // 3. Delete the module itself
      batch.delete(doc(db, 'moduls', selectedModulForDelete.id));

      await batch.commit();

      toast.success('Modul berhasil dihapus');
      setShowDeleteModal(false);
      setSelectedModulForDelete(null);
      fetchModuls();
    } catch (error) {
      console.error('Error deleting modul:', error);
      toast.error('Gagal menghapus modul');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleArchive = async (modul: Modul) => {
    try {
      const newStatus = !modul.is_archived;
      await updateDoc(doc(db, 'moduls', modul.id), {
        is_archived: newStatus,
        is_published: newStatus ? false : modul.is_published // Unpublish if archiving
      });
      toast.success(newStatus ? 'Modul berhasil diarsipkan' : 'Modul berhasil dikembalikan dari arsip');
      fetchModuls();
    } catch (error) {
      console.error('Error archiving modul:', error);
      toast.error('Gagal mengarsipkan modul');
    }
  };

  const checkSubsequent = async (modulId: string) => {
    const q = query(collection(db, 'moduls'), where('prasyarat_id', '==', modulId));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  const openCopyModal = async (modul: Modul) => {
    setSelectedModulForCopy(modul);
    const hasSub = await checkSubsequent(modul.id);
    setHasSubsequent(hasSub);
    setCopySubsequent(false);
    setShowCopyModal(true);
  };

  const handleCopy = async () => {
    if (!selectedModulForCopy || !user) return;
    
    setCopying(true);
    setShowCopyModal(false);
    
    try {
      const batch = writeBatch(db);
      
      // Recursive function to copy module and its subsequent modules
      const copyModuleRecursive = async (originalId: string, newPrasyaratId: string | null, suffix: string = ' (Copy)') => {
        // 1. Fetch original module data
        const originalDoc = await getDoc(doc(db, 'moduls', originalId));
        if (!originalDoc.exists()) return null;
        
        const originalData = originalDoc.data();
        const newModulRef = doc(collection(db, 'moduls'));
        const newModulId = newModulRef.id;
        
        // 2. Create new module data
        const newModulData = {
          ...originalData,
          judul_modul: originalData.judul_modul + suffix,
          prasyarat_id: newPrasyaratId,
          created_at: new Date().toISOString(), // ISO string for DB
          is_published: false // Always copy as draft
        };
        
        batch.set(newModulRef, newModulData);
        
        // 3. Copy modul items
        const itemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', originalId));
        const itemsSnapshot = await getDocs(itemsQuery);
        
        itemsSnapshot.docs.forEach(itemDoc => {
          const newItemRef = doc(collection(db, 'modul_items'));
          batch.set(newItemRef, {
            ...itemDoc.data(),
            modul_id: newModulId,
            created_at: new Date().toISOString() // ISO string for DB
          });
        });
        
        // 4. If copySubsequent is true, find and copy child modules
        if (copySubsequent) {
          const childrenQuery = query(collection(db, 'moduls'), where('prasyarat_id', '==', originalId));
          const childrenSnapshot = await getDocs(childrenQuery);
          
          for (const childDoc of childrenSnapshot.docs) {
            await copyModuleRecursive(childDoc.id, newModulId, ''); // No suffix for subsequent modules to keep it clean
          }
        }
        
        return newModulId;
      };

      await copyModuleRecursive(selectedModulForCopy.id, (selectedModulForCopy as any).prasyarat_id || null);
      
      await batch.commit();
      toast.success('Modul berhasil disalin');
      fetchModuls();
    } catch (error) {
      console.error('Error copying modul:', error);
      toast.error('Gagal menyalin modul');
    } finally {
      setCopying(false);
      setSelectedModulForCopy(null);
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
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${
                    modul.is_archived
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      : modul.is_published 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {modul.is_archived ? (
                      <>
                        <BookOpen className="w-3 h-3" />
                        <span>Diarsipkan</span>
                      </>
                    ) : modul.is_published ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        <span>Dipublikasikan</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3" />
                        <span>Draft</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(modul.created_at)}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {modul.judul_modul}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {modul.mata_pelajaran}
                </p>
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Users className="w-4 h-4 mr-1.5" />
                    <span>Target: {modul.tipe_target === 'KELAS' ? 'Kelas' : 'Siswa Tertentu'}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Eye className="w-4 h-4 mr-1.5" />
                    <span>Diakses oleh: <span className="font-semibold text-gray-900 dark:text-white">{modul.viewers?.length || 0}</span> Siswa</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
                <button
                  onClick={() => toggleArchive(modul)}
                  className={`p-2 rounded-lg transition-colors ${
                    modul.is_archived 
                      ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                      : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                  title={modul.is_archived ? "Buka Arsip" : "Arsipkan Modul"}
                >
                  <BookOpen className="w-5 h-5" />
                </button>
                <button
                  onClick={() => openCopyModal(modul)}
                  className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                  title="Salin Modul"
                  disabled={copying}
                >
                  <Copy className="w-5 h-5" />
                </button>
                <Link
                  to={`/guru/modul/create?prasyarat=${modul.id}`}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Tambah Modul Lanjutan"
                >
                  <Plus className="w-5 h-5" />
                </Link>
                <Link
                  to={`/guru/modul/${modul.id}`}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Edit Modul"
                >
                  <Edit className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => handleDeleteClick(modul)}
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center space-x-3 text-red-600 mb-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Hapus Modul?</h3>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Apakah Anda yakin ingin menghapus modul <span className="font-semibold text-gray-900 dark:text-white">"{selectedModulForDelete?.judul_modul}"</span>? Tindakan ini tidak dapat dibatalkan dan semua data terkait modul ini akan hilang.
                </p>

                <div className="mb-6">
                  <label className="flex items-start space-x-3 cursor-pointer p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                    <input
                      type="checkbox"
                      checked={deleteProgress}
                      onChange={(e) => setDeleteProgress(e.target.checked)}
                      className="mt-1 rounded text-red-600 focus:ring-red-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm text-red-800 dark:text-red-300">
                      <strong>Hapus juga nilai dan progres siswa</strong>
                      <br />
                      Centang ini jika Anda ingin menghapus semua data pengerjaan siswa yang sudah dinilai maupun belum pada modul ini.
                    </span>
                  </label>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menghapus...
                      </>
                    ) : (
                      'Ya, Hapus'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Copy Modal */}
      <AnimatePresence>
        {showCopyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Salin Modul</h3>
                  <button onClick={() => setShowCopyModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Anda akan menyalin modul <span className="font-semibold text-gray-900 dark:text-white">"{selectedModulForCopy?.judul_modul}"</span>.
                </p>

                {hasSubsequent && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Modul Lanjutan Terdeteksi</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Modul ini memiliki modul-modul lanjutan yang bergantung padanya. Apakah Anda juga ingin menyalin seluruh rangkaian modul tersebut?
                        </p>
                        <label className="flex items-center space-x-2 mt-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={copySubsequent}
                            onChange={(e) => setCopySubsequent(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-700 dark:text-blue-300 group-hover:underline">Ya, salin juga modul lanjutan</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowCopyModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center"
                  >
                    Salin Sekarang
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Copying Overlay */}
      <AnimatePresence>
        {copying && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white">Menyalin Modul...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Mohon tunggu sebentar, kami sedang menduplikasi data Anda.</p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
