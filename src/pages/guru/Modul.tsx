import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Edit, Trash2, Eye, Users, Copy, X, Loader2, CheckCircle, FileText, Activity, Share2, MoreVertical, Download } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Modul {
  id: string;
  judul_modul: string;
  mata_pelajaran: string;
  tipe_target: string;
  target_kelas_ids?: string[];
  target_siswa_ids?: string[];
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number, bottom?: number, right: number } | null>(null);
  const [kelasMap, setKelasMap] = useState<Record<string, string>>({});
  const [siswaMap, setSiswaMap] = useState<Record<string, string>>({});

  const fetchModuls = async () => {
    if (!user) return;
    try {
      // Fetch Kelas and Siswa for target mapping
      const kelasSnapshot = await getDocs(collection(db, 'kelas'));
      const kMap: Record<string, string> = {};
      kelasSnapshot.docs.forEach(doc => {
        kMap[doc.id] = doc.data().nama_kelas;
      });
      setKelasMap(kMap);

      const siswaSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'SISWA')));
      const sMap: Record<string, string> = {};
      siswaSnapshot.docs.forEach(doc => {
        sMap[doc.id] = doc.data().nama_lengkap;
      });
      setSiswaMap(sMap);

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

  const handleMenuClick = (e: React.MouseEvent, modulId: string) => {
    if (openMenuId === modulId) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 200; // Estimated height of the menu
      const spaceBelow = window.innerHeight - rect.bottom;
      
      if (spaceBelow < menuHeight) {
        setMenuPosition({
          bottom: window.innerHeight - rect.top + 8,
          right: window.innerWidth - rect.right
        });
      } else {
        setMenuPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right
        });
      }
      setOpenMenuId(modulId);
    }
  };

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

  const handleShare = (modulId: string) => {
    const url = `${window.location.origin}/siswa/modul/${modulId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link modul berhasil disalin ke clipboard');
    }).catch(() => {
      toast.error('Gagal menyalin link');
    });
  };

  const handleDownloadPdf = async (modul: any) => {
    try {
      toast.info('Menyiapkan file PDF...');
      
      // Fetch modul items
      const itemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', modul.id));
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a: any, b: any) => a.urutan - b.urutan);

      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text(modul.judul_modul || 'Modul Belajar', 14, 22);
      
      doc.setFontSize(12);
      doc.text(`Mata Pelajaran: ${modul.mata_pelajaran || '-'}`, 14, 32);
      doc.text(`Dibuat pada: ${modul.created_at ? formatDate(modul.created_at) : '-'}`, 14, 40);
      
      // Description
      let startY = 50;
      if (modul.deskripsi) {
        doc.setFontSize(11);
        const splitDesc = doc.splitTextToSize(modul.deskripsi, 180);
        doc.text(splitDesc, 14, startY);
        startY += (splitDesc.length * 6) + 10;
      }

      // Items
      items.forEach((item: any, index: number) => {
        if (startY > 270) {
          doc.addPage();
          startY = 20;
        }

        doc.setFontSize(14);
        doc.text(`${index + 1}. ${item.judul_item} (${item.tipe_item})`, 14, startY);
        startY += 8;

        if (item.deskripsi) {
          doc.setFontSize(10);
          const splitItemDesc = doc.splitTextToSize(item.deskripsi, 180);
          doc.text(splitItemDesc, 14, startY);
          startY += (splitItemDesc.length * 5) + 5;
        }

        if (item.tipe_item === 'MATERI' || item.tipe_item === 'TUGAS') {
          // Strip HTML tags from konten
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = item.konten || '';
          const textContent = tempDiv.textContent || tempDiv.innerText || '';
          
          if (textContent.trim()) {
            doc.setFontSize(10);
            const splitContent = doc.splitTextToSize(textContent.trim(), 180);
            
            // Check if content fits on current page
            if (startY + (splitContent.length * 5) > 280) {
              doc.addPage();
              startY = 20;
            }
            
            doc.text(splitContent, 14, startY);
            startY += (splitContent.length * 5) + 10;
          }
        } else if (item.tipe_item === 'KUIS') {
          try {
            const kuisData = JSON.parse(item.konten || '[]');
            if (Array.isArray(kuisData) && kuisData.length > 0) {
              const tableData = kuisData.map((q: any, i: number) => [
                i + 1,
                q.pertanyaan,
                q.opsi.join('\n'),
                q.opsi[q.jawaban_benar]
              ]);

              autoTable(doc, {
                startY: startY,
                head: [['No', 'Pertanyaan', 'Opsi Jawaban', 'Jawaban Benar']],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 9 },
                columnStyles: {
                  0: { cellWidth: 10 },
                  1: { cellWidth: 60 },
                  2: { cellWidth: 60 },
                  3: { cellWidth: 40 }
                }
              });
              startY = (doc as any).lastAutoTable.finalY + 10;
            }
          } catch (e) {
            console.error('Error parsing kuis data', e);
          }
        } else if (item.tipe_item === 'YOUTUBE' || item.tipe_item === 'PDF') {
            doc.setFontSize(10);
            doc.text(`Link: ${item.konten}`, 14, startY);
            startY += 10;
        }
        
        startY += 5;
      });

      doc.save(`Modul_${modul.judul_modul.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
      toast.success('Modul berhasil diunduh');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Gagal mengunduh modul');
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Judul Modul</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mata Pelajaran</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Diakses Oleh</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {moduls.map((modul) => (
                  <tr key={modul.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {modul.ikon ? (
                          <img src={modul.ikon} alt="" className="w-8 h-8 rounded-lg mr-3 object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center mr-3">
                            <BookOpen className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{modul.judul_modul}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">
                            {modul.is_published ? (
                              <span className="text-green-600 dark:text-green-400 font-semibold">Terbit</span>
                            ) : (
                              <span className="text-orange-600 dark:text-orange-400 font-semibold">Draft</span>
                            )}
                            {modul.is_archived && <span className="ml-2 text-gray-400">Arsip</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 dark:text-gray-300">{modul.mata_pelajaran}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4 mr-2" />
                          <span className="font-medium">{modul.tipe_target === 'KELAS' ? 'Kelas' : 'Siswa Tertentu'}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2" title={
                          modul.tipe_target === 'KELAS' 
                            ? modul.target_kelas_ids?.map(id => kelasMap[id] || 'Unknown').join(', ')
                            : modul.target_siswa_ids?.map(id => siswaMap[id] || 'Unknown').join(', ')
                        }>
                          {modul.tipe_target === 'KELAS' 
                            ? modul.target_kelas_ids?.map(id => kelasMap[id] || 'Unknown').join(', ') || '-'
                            : modul.target_siswa_ids?.map(id => siswaMap[id] || 'Unknown').join(', ') || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Eye className="w-4 h-4 mr-2" />
                        <span>Diakses oleh: <span className="font-bold text-gray-900 dark:text-white">{modul.viewers?.length || 0}</span> Siswa</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1 relative">
                        <Link
                          to={`/guru/modul/${modul.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit Modul"
                        >
                          <Edit className="w-5 h-5" />
                        </Link>
                        <Link
                          to={`/siswa/modul/${modul.id}`}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Pratinjau Modul"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => openCopyModal(modul)}
                          className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title="Salin Modul"
                          disabled={copying}
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                        
                        <div className="relative ml-1">
                          <button 
                            onClick={(e) => handleMenuClick(e, modul.id)}
                            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          <AnimatePresence>
                            {openMenuId === modul.id && menuPosition && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setMenuPosition(null);
                                  }}
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: menuPosition.bottom ? 10 : -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: menuPosition.bottom ? 10 : -10 }}
                                  style={{ 
                                    top: menuPosition.top, 
                                    bottom: menuPosition.bottom,
                                    right: menuPosition.right 
                                  }}
                                  className="fixed w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden text-left"
                                >
                                  <div className="py-1">
                                    {modul.is_published && (
                                      <button
                                        onClick={() => {
                                          handleShare(modul.id);
                                          setOpenMenuId(null);
                                          setMenuPosition(null);
                                        }}
                                        className="w-full flex items-center px-4 py-2.5 text-sm text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                                      >
                                        <Share2 className="w-4 h-4 mr-3" />
                                        <span>Bagikan</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        handleDownloadPdf(modul);
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                      }}
                                      className="w-full flex items-center px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                    >
                                      <Download className="w-4 h-4 mr-3" />
                                      <span>Download PDF</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigate(`/guru/modul/${modul.id}/monitoring`);
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                      }}
                                      className="w-full flex items-center px-4 py-2.5 text-sm text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                                    >
                                      <Activity className="w-4 h-4 mr-3" />
                                      <span>Monitoring</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        toggleArchive(modul);
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                      }}
                                      className="w-full flex items-center px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                    >
                                      <BookOpen className="w-4 h-4 mr-3" />
                                      <span>{modul.is_archived ? "Buka Arsip" : "Arsipkan"}</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleDeleteClick(modul);
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                      }}
                                      className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4 mr-3" />
                                      <span>Hapus</span>
                                    </button>
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              key="delete-modal"
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
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white"><span>Hapus Modul?</span></h3>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  <span>Apakah Anda yakin ingin menghapus modul </span>
                  <span className="font-semibold text-gray-900 dark:text-white">"{selectedModulForDelete?.judul_modul}"</span>
                  <span>? Tindakan ini tidak dapat dibatalkan dan semua data terkait modul ini akan hilang.</span>
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
                      <span>Centang ini jika Anda ingin menghapus semua data pengerjaan siswa yang sudah dinilai maupun belum pada modul ini.</span>
                    </span>
                  </label>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <span>Batal</span>
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span>Menghapus...</span>
                      </>
                    ) : (
                      <span>Ya, Hapus</span>
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
              key="copy-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white"><span>Salin Modul</span></h3>
                  <button onClick={() => setShowCopyModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  <span>Anda akan menyalin modul </span>
                  <span className="font-semibold text-gray-900 dark:text-white">"{selectedModulForCopy?.judul_modul}"</span>
                  <span>.</span>
                </p>

                {hasSubsequent && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300"><span>Modul Lanjutan Terdeteksi</span></p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          <span>Modul ini memiliki modul-modul lanjutan yang bergantung padanya. Apakah Anda juga ingin menyalin seluruh rangkaian modul tersebut?</span>
                        </p>
                        <label className="flex items-center space-x-2 mt-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={copySubsequent}
                            onChange={(e) => setCopySubsequent(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-700 dark:text-blue-300 group-hover:underline"><span>Ya, salin juga modul lanjutan</span></span>
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
                    <span>Batal</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center"
                  >
                    <span>Salin Sekarang</span>
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
          <motion.div
            key="copying-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
          >
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white"><span>Menyalin Modul...</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400"><span>Mohon tunggu sebentar, kami sedang menduplikasi data Anda.</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
