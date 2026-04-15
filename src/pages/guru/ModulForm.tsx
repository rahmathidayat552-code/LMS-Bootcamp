import React, { useRef, useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, GripVertical, ArrowUp, ArrowDown, CheckCircle, ChevronUp } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useModulForm, ModulItem } from './hooks/useModulForm';
import ModulFormHeader from './ModulFormHeader';
import ModulItemEditor from './ModulItemEditor';

function SortableStepItem({ item, index, isActive, onClick, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: { 
  item: ModulItem, 
  index: number, 
  isActive: boolean, 
  onClick: () => void, 
  onRemove: (e: React.MouseEvent) => void,
  onMoveUp: (e: React.MouseEvent) => void,
  onMoveDown: (e: React.MouseEvent) => void,
  isFirst: boolean,
  isLast: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 rounded-xl border mb-2 cursor-pointer transition-colors ${isActive ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-300'}`}
      onClick={onClick}
    >
      <div className="flex items-center space-x-3 overflow-hidden">
        <div {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <div className="truncate">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
            Tahap {index + 1}: {item.judul_item || 'Tanpa Judul'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {item.tipe_item === 'MATERI' ? 'Materi Teks' :
             item.tipe_item === 'PDF' ? 'Dokumen PDF' :
             item.tipe_item === 'YOUTUBE' ? 'Video YouTube' :
             item.tipe_item === 'KUIS' ? 'Kuis/Soal' : 'Tugas Upload'}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        <button onClick={onRemove} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Hapus Tahapan">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function ModulForm() {
  const { id } = useParams();
  const { setIsSidebarOpen } = useOutletContext<{ setIsSidebarOpen?: (val: boolean) => void }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Close sidebar when entering this page
    if (setIsSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [setIsSidebarOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  const {
    isEditing,
    loading,
    fetching,
    judulModul, setJudulModul,
    mataPelajaran, setMataPelajaran,
    deskripsi, setDeskripsi,
    tipeTarget, setTipeTarget,
    targetKelasIds, setTargetKelasIds,
    targetSiswaIds, setTargetSiswaIds,
    isPublished, setIsPublished,
    ikon, setIkon,
    prasyaratId, setPrasyaratId,
    items, setItems,
    currentStepIndex, setCurrentStepIndex,
    kelasList,
    siswaList,
    existingModuls,
    showPublishSuccess, setShowPublishSuccess,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    handleSave,
    navigate
  } = useModulForm(id);

  useEffect(() => {
    if (showPublishSuccess) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/guru/modul');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [showPublishSuccess, navigate]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        newItems.forEach((item, i) => {
          item.urutan = i + 1;
        });
        
        if (currentStepIndex === oldIndex) {
          setCurrentStepIndex(newIndex);
        } else if (currentStepIndex > oldIndex && currentStepIndex <= newIndex) {
          setCurrentStepIndex(currentStepIndex - 1);
        } else if (currentStepIndex < oldIndex && currentStepIndex >= newIndex) {
          setCurrentStepIndex(currentStepIndex + 1);
        }

        return newItems;
      });
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    
    newItems.forEach((item, i) => {
      item.urutan = i + 1;
    });
    setItems(newItems);
    if (currentStepIndex === index) {
      setCurrentStepIndex(index - 1);
    } else if (currentStepIndex === index - 1) {
      setCurrentStepIndex(index);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    
    newItems.forEach((item, i) => {
      item.urutan = i + 1;
    });
    setItems(newItems);
    if (currentStepIndex === index) {
      setCurrentStepIndex(index + 1);
    } else if (currentStepIndex === index + 1) {
      setCurrentStepIndex(index);
    }
  };

  if (fetching) {
    return <div className="flex justify-center items-center h-64">Memuat...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/guru/modul')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Modul' : 'Buat Modul Baru'}
          </h1>
        </div>
      </div>

      <ModulFormHeader 
        judulModul={judulModul} setJudulModul={setJudulModul}
        mataPelajaran={mataPelajaran} setMataPelajaran={setMataPelajaran}
        deskripsi={deskripsi} setDeskripsi={setDeskripsi}
        tipeTarget={tipeTarget} setTipeTarget={setTipeTarget}
        targetKelasIds={targetKelasIds} setTargetKelasIds={setTargetKelasIds}
        targetSiswaIds={targetSiswaIds} setTargetSiswaIds={setTargetSiswaIds}
        kelasList={kelasList} siswaList={siswaList}
        prasyaratId={prasyaratId} setPrasyaratId={setPrasyaratId}
        existingModuls={existingModuls}
        ikon={ikon} setIkon={setIkon}
        fileInputRef={fileInputRef}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Tahapan Belajar</h3>
            
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto pr-2">
                  {items.map((item, index) => (
                    <SortableStepItem
                      key={item.id}
                      item={item}
                      index={index}
                      isActive={currentStepIndex === index}
                      onClick={() => setCurrentStepIndex(index)}
                      onRemove={(e) => {
                        e.stopPropagation();
                        setItemToDelete(index);
                      }}
                      onMoveUp={(e) => {
                        e.stopPropagation();
                        handleMoveUp(index);
                      }}
                      onMoveDown={(e) => {
                        e.stopPropagation();
                        handleMoveDown(index);
                      }}
                      isFirst={index === 0}
                      isLast={index === items.length - 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {items.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada tahapan.</p>
                <p className="text-xs text-gray-400 mt-1">Tambahkan tahapan pertama di bawah.</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tambah Tahapan Baru</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAddItem('MATERI')}
                  className="flex items-center justify-center px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> Teks
                </button>
                <button
                  onClick={() => handleAddItem('PDF')}
                  className="flex items-center justify-center px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> PDF
                </button>
                <button
                  onClick={() => handleAddItem('YOUTUBE')}
                  className="flex items-center justify-center px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> Video
                </button>
                <button
                  onClick={() => handleAddItem('KUIS')}
                  className="flex items-center justify-center px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> Kuis
                </button>
                <button
                  onClick={() => handleAddItem('TUGAS')}
                  className="col-span-2 flex items-center justify-center px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> Tugas Upload
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          {items.length > 0 && currentStepIndex < items.length ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Editor Tahapan {currentStepIndex + 1}
                </h3>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full">
                  {items[currentStepIndex].tipe_item}
                </span>
              </div>
              
              <ModulItemEditor 
                item={items[currentStepIndex]} 
                index={currentStepIndex} 
                handleItemChange={handleItemChange} 
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Belum Ada Tahapan Dipilih</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Pilih tahapan dari daftar di sebelah kiri atau tambahkan tahapan baru untuk mulai mengedit konten.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-40 md:left-64 transition-all duration-300">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {items.length} Tahapan • {isEditing ? 'Mengedit Modul' : 'Modul Baru'}
          </div>
          <div className="flex space-x-3 w-full sm:w-auto">
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Simpan Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyimpan...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Perbarui & Publish' : 'Publish Modul'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showPublishSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Modul Berhasil Dipublish!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Modul Anda sekarang dapat diakses oleh siswa sesuai dengan target yang telah ditentukan.
            </p>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Mengalihkan ke halaman daftar modul dalam {countdown} detik...
            </p>
          </div>
        </div>
      )}

      {itemToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Hapus Tahapan?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus tahapan ini? Data yang dihapus tidak dapat dikembalikan.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  handleRemoveItem(itemToDelete);
                  setItemToDelete(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-40 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        title="Kembali ke atas"
      >
        <ChevronUp className="w-6 h-6" />
      </button>
    </div>
  );
}
