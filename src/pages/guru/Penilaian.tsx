import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, MoreVertical, Settings, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Modul {
  id: string;
  judul_modul: string;
  mata_pelajaran: string;
  created_at: any;
}

export default function Penilaian() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [moduls, setModuls] = useState<Modul[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number, bottom?: number, right: number } | null>(null);

  const handleMenuClick = (e: React.MouseEvent, modulId: string) => {
    e.stopPropagation();
    if (openMenuId === modulId) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 60; // Estimated height of the menu
      const spaceBelow = window.innerHeight - rect.bottom;
      
      let position: { top?: number, bottom?: number, right: number } = { right: window.innerWidth - rect.right };
      
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        // Position above
        position.bottom = window.innerHeight - rect.top + 8;
      } else {
        // Position below
        position.top = rect.bottom + 8;
      }
      
      setMenuPosition(position);
      setOpenMenuId(modulId);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchModuls = async () => {
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
        
        data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setModuls(data);

        // Setup listener for completed counts
        const unsubscribes = data.map(modul => {
          const progressQuery = query(
            collection(db, 'progres_siswa'),
            where('modul_id', '==', modul.id)
          );
          
          return onSnapshot(progressQuery, async (progressSnapshot) => {
            // To know if a student has completed all items, we need to know the total items
            const itemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', modul.id));
            const itemsSnapshot = await getDocs(itemsQuery);
            const totalItems = itemsSnapshot.size;

            if (totalItems === 0) {
              setCompletedCounts(prev => ({ ...prev, [modul.id]: 0 }));
              return;
            }

            const studentProgress: Record<string, number> = {};
            progressSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.status_selesai) {
                studentProgress[data.siswa_id] = (studentProgress[data.siswa_id] || 0) + 1;
              }
            });

            const completedStudents = Object.values(studentProgress).filter(count => count >= totalItems).length;
            setCompletedCounts(prev => ({ ...prev, [modul.id]: completedStudents }));
          });
        });

        setLoading(false);

        return () => {
          unsubscribes.forEach(unsub => unsub());
        };
      } catch (error) {
        console.error('Error fetching moduls:', error);
        setLoading(false);
      }
    };

    fetchModuls();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Penilaian Modul</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola dan berikan nilai untuk tugas siswa pada modul Anda.</p>
      </div>

      {moduls.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Belum Ada Modul</h3>
          <p className="text-gray-500 dark:text-gray-400">Anda belum membuat modul apa pun.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {moduls.map((modul) => (
            <div 
              key={modul.id}
              onClick={() => navigate(`/guru/penilaian/${modul.id}`)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {modul.mata_pelajaran}
                  </span>
                  
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={(e) => handleMenuClick(e, modul.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    <AnimatePresence>
                      {openMenuId === modul.id && menuPosition && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => {
                              setOpenMenuId(null);
                              setMenuPosition(null);
                            }}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: menuPosition.top ? -10 : 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: menuPosition.top ? -10 : 10 }}
                            style={{ 
                              position: 'fixed',
                              top: menuPosition.top,
                              bottom: menuPosition.bottom,
                              right: menuPosition.right
                            }}
                            className="w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
                          >
                            <button
                              onClick={() => {
                                navigate(`/guru/penilaian/${modul.id}/bobot`);
                                setOpenMenuId(null);
                                setMenuPosition(null);
                              }}
                              className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Settings className="w-4 h-4 mr-3" />
                              Atur Bobot Nilai
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {modul.judul_modul}
                </h3>
                
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                  <Users className="w-4 h-4 mr-2" />
                  <span>{completedCounts[modul.id] || 0} Siswa Selesai</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
