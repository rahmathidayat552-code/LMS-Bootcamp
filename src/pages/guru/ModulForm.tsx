import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, GripVertical, ArrowUp, ArrowDown, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface Kelas {
  id: string;
  nama_kelas: string;
  tingkat: number;
}

interface Siswa {
  id: string;
  nama_lengkap: string;
  kelas_id?: string;
}

interface ModulItem {
  id: string;
  tipe_item: 'MATERI' | 'PDF' | 'YOUTUBE' | 'KUIS' | 'TUGAS';
  judul_item: string;
  deskripsi: string;
  konten: string; // For KUIS, this will be JSON stringified array of questions
  urutan: number;
}

interface KuisSoal {
  pertanyaan: string;
  gambar?: string; // Base64 image
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  kunci_jawaban: 'A' | 'B' | 'C' | 'D';
  bobot_nilai: number;
}

export default function ModulForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  
  // Form State
  const [judulModul, setJudulModul] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tipeTarget, setTipeTarget] = useState<'KELAS' | 'SISWA'>('KELAS');
  const [targetKelasIds, setTargetKelasIds] = useState<string[]>([]);
  const [targetSiswaIds, setTargetSiswaIds] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [ikon, setIkon] = useState<string | null>(null);
  
  const [items, setItems] = useState<ModulItem[]>([]);

  // Data State
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'blockquote', 'code-block'],
      ['clean']
    ],
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'blockquote', 'code-block'
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Kelas
        const kelasSnapshot = await getDocs(collection(db, 'kelas'));
        setKelasList(kelasSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kelas)));

        // Fetch Siswa
        const siswaQuery = query(collection(db, 'users'), where('role', '==', 'SISWA'));
        const siswaSnapshot = await getDocs(siswaQuery);
        setSiswaList(siswaSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Siswa)));

        if (isEditing && id) {
          // Fetch Modul
          const modulDoc = await getDoc(doc(db, 'moduls', id));
          if (modulDoc.exists()) {
            const data = modulDoc.data();
            setJudulModul(data.judul_modul || '');
            setMataPelajaran(data.mata_pelajaran || '');
            setDeskripsi(data.deskripsi || '');
            setTipeTarget(data.tipe_target || 'KELAS');
            setTargetKelasIds(data.target_kelas_ids || []);
            setTargetSiswaIds(data.target_siswa_ids || []);
            setIsPublished(data.is_published || false);
            setIkon(data.ikon || null);

            // Fetch Items
            const itemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', id));
            const itemsSnapshot = await getDocs(itemsQuery);
            const fetchedItems = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ModulItem));
            fetchedItems.sort((a, b) => a.urutan - b.urutan);
            setItems(fetchedItems);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Gagal memuat data');
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [id, isEditing]);

  const handleAddItem = (tipe: ModulItem['tipe_item']) => {
    let defaultKonten = '';
    if (tipe === 'KUIS') {
      defaultKonten = '[]';
    } else if (tipe === 'TUGAS') {
      defaultKonten = JSON.stringify({
        allow_link: true,
        allow_file: false,
        allowed_extensions: []
      });
    }

    const newItem: ModulItem = {
      id: `temp_${Date.now()}`,
      tipe_item: tipe,
      judul_item: '',
      deskripsi: '',
      konten: defaultKonten,
      urutan: items.length + 1
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    // Reorder
    newItems.forEach((item, i) => {
      item.urutan = i + 1;
    });
    setItems(newItems);
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
  };

  const handleItemChange = (index: number, field: keyof ModulItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSave = async (publish: boolean) => {
    if (!judulModul || !mataPelajaran) {
      toast.error('Judul modul dan mata pelajaran wajib diisi');
      return;
    }
    if (tipeTarget === 'KELAS' && targetKelasIds.length === 0) {
      toast.error('Pilih minimal satu kelas target');
      return;
    }
    if (tipeTarget === 'SISWA' && targetSiswaIds.length === 0) {
      toast.error('Pilih minimal satu siswa target');
      return;
    }
    if (items.length === 0) {
      toast.error('Tambahkan minimal satu tahapan belajar');
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      if (!items[i].judul_item) {
        toast.error(`Judul tahapan ke-${i + 1} wajib diisi`);
        return;
      }
      if (items[i].tipe_item === 'KUIS') {
        try {
          const questions = JSON.parse(items[i].konten || '[]');
          if (questions.length === 0) {
            toast.error(`Tahapan Kuis/Soal ke-${i + 1} harus memiliki minimal 1 pertanyaan`);
            return;
          }
        } catch (e) {
          toast.error(`Format kuis pada tahapan ke-${i + 1} tidak valid`);
          return;
        }
      }
      if (items[i].tipe_item === 'TUGAS') {
        try {
          const config = items[i].konten ? JSON.parse(items[i].konten) : { allow_link: true, allow_file: false };
          if (!config.allow_link && !config.allow_file) {
            toast.error(`Tahapan Tugas ke-${i + 1} harus mengizinkan minimal satu jenis pengumpulan (Link atau File)`);
            return;
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const modulRef = isEditing && id ? doc(db, 'moduls', id) : doc(collection(db, 'moduls'));
      const modulId = modulRef.id;

      const modulData = {
        guru_id: user?.uid,
        mata_pelajaran: mataPelajaran,
        judul_modul: judulModul,
        deskripsi,
        tipe_target: tipeTarget,
        target_kelas_ids: tipeTarget === 'KELAS' ? targetKelasIds : [],
        target_siswa_ids: tipeTarget === 'SISWA' ? targetSiswaIds : [],
        ikon,
        is_published: publish,
        created_at: new Date().toISOString()
      };

      if (isEditing) {
        batch.update(modulRef, modulData);
      } else {
        batch.set(modulRef, modulData);
      }

      // Handle items (For simplicity, we delete old items and recreate them if editing)
      if (isEditing && id) {
        const oldItemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', id));
        const oldItemsSnapshot = await getDocs(oldItemsQuery);
        oldItemsSnapshot.docs.forEach(d => {
          batch.delete(d.ref);
        });
      }

      items.forEach((item, index) => {
        const itemRef = doc(collection(db, 'modul_items'));
        batch.set(itemRef, {
          modul_id: modulId,
          tipe_item: item.tipe_item,
          judul_item: item.judul_item,
          deskripsi: item.deskripsi,
          konten: item.konten,
          urutan: index + 1,
          created_at: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.success(publish ? 'Modul berhasil dipublikasikan' : 'Modul berhasil disimpan sebagai draft');
      navigate('/guru/modul');
    } catch (error: any) {
      console.error('Error saving modul:', error);
      toast.error('Gagal menyimpan modul: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 300000) { // 300KB limit for base64
        toast.error('Ukuran file terlalu besar (maksimal 300KB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setIkon(reader.result as string);
      };
      reader.readAsDataURL(file);
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ikon Modul (PNG/JPG)</label>
            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-500 transition-colors cursor-pointer relative group">
              {ikon ? (
                <div className="relative w-full aspect-square">
                  <img src={ikon} alt="Icon Preview" className="w-full h-full object-cover rounded-lg" />
                  <button 
                    onClick={() => setIkon(null)}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Plus className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Klik untuk upload ikon</p>
                  <p className="text-xs text-gray-400 mt-1">Maks 300KB</p>
                </div>
              )}
              <input 
                type="file" 
                accept="image/png, image/jpeg" 
                onChange={handleIconUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul Modul *</label>
              <input
                type="text"
                value={judulModul}
                onChange={(e) => setJudulModul(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Contoh: Pengenalan Algoritma"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mata Pelajaran *</label>
              <input
                type="text"
                value={mataPelajaran}
                onChange={(e) => setMataPelajaran(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Contoh: Pemrograman Dasar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi Singkat</label>
              <textarea
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Jelaskan secara singkat tentang modul ini..."
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Peserta *</label>
          <div className="flex space-x-4 mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={tipeTarget === 'KELAS'}
                onChange={() => setTipeTarget('KELAS')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm dark:text-gray-300">Pilih Kelas</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={tipeTarget === 'SISWA'}
                onChange={() => setTipeTarget('SISWA')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm dark:text-gray-300">Pilih Siswa Tertentu</span>
            </label>
          </div>

          {tipeTarget === 'KELAS' ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
              {kelasList.map(kelas => (
                <label key={kelas.id} className="flex items-center space-x-3 mb-2 last:mb-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetKelasIds.includes(kelas.id)}
                    onChange={(e) => {
                      if (e.target.checked) setTargetKelasIds([...targetKelasIds, kelas.id]);
                      else setTargetKelasIds(targetKelasIds.filter(id => id !== kelas.id));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm dark:text-gray-300">{kelas.tingkat} {kelas.nama_kelas}</span>
                </label>
              ))}
              {kelasList.length === 0 && <p className="text-sm text-gray-500">Belum ada data kelas.</p>}
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
              {siswaList.map(siswa => (
                <label key={siswa.id} className="flex items-center space-x-3 mb-2 last:mb-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetSiswaIds.includes(siswa.id)}
                    onChange={(e) => {
                      if (e.target.checked) setTargetSiswaIds([...targetSiswaIds, siswa.id]);
                      else setTargetSiswaIds(targetSiswaIds.filter(id => id !== siswa.id));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm dark:text-gray-300">{siswa.nama_lengkap}</span>
                </label>
              ))}
              {siswaList.length === 0 && <p className="text-sm text-gray-500">Belum ada data siswa.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tahapan Belajar</h2>
        
        {items.map((item, index) => (
          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Tahap {index + 1}: {
                    item.tipe_item === 'MATERI' ? 'Materi Teks' :
                    item.tipe_item === 'PDF' ? 'Dokumen PDF' :
                    item.tipe_item === 'YOUTUBE' ? 'Video YouTube' :
                    item.tipe_item === 'KUIS' ? 'Kuis/Soal' : 'Tugas Upload'
                  }
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 p-1" title="Pindah ke Atas">
                  <ArrowUp className="w-5 h-5" />
                </button>
                <button onClick={() => handleMoveDown(index)} disabled={index === items.length - 1} className="text-gray-400 hover:text-blue-600 disabled:opacity-30 p-1" title="Pindah ke Bawah">
                  <ArrowDown className="w-5 h-5" />
                </button>
                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-1" title="Hapus Tahapan">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul Tahapan *</label>
                <input
                  type="text"
                  value={item.judul_item}
                  onChange={(e) => handleItemChange(index, 'judul_item', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Contoh: Bacaan Bab 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruksi / Penjelasan</label>
                <textarea
                  value={item.deskripsi}
                  onChange={(e) => handleItemChange(index, 'deskripsi', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Berikan instruksi apa yang harus dilakukan siswa pada tahap ini..."
                />
              </div>

              {/* Dynamic Content Field based on Type */}
              {item.tipe_item === 'MATERI' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Isi Materi</label>
                  <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                    <ReactQuill
                      theme="snow"
                      value={item.konten}
                      onChange={(content) => handleItemChange(index, 'konten', content)}
                      modules={quillModules}
                      formats={quillFormats}
                      placeholder="Tuliskan materi pembelajaran di sini..."
                      className="min-h-[200px]"
                    />
                  </div>
                </div>
              )}

              {item.tipe_item === 'PDF' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link URL PDF</label>
                  <input
                    type="url"
                    value={item.konten}
                    onChange={(e) => handleItemChange(index, 'konten', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://contoh.com/dokumen.pdf"
                  />
                  <p className="text-xs text-gray-500 mt-1">Masukkan link langsung ke file PDF (Google Drive, dll).</p>
                </div>
              )}

              {item.tipe_item === 'YOUTUBE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link Video YouTube</label>
                  <input
                    type="url"
                    value={item.konten}
                    onChange={(e) => handleItemChange(index, 'konten', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
              )}

              {item.tipe_item === 'KUIS' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Tambahkan soal pilihan ganda untuk pre-test atau post-test.
                    </p>
                  </div>
                  
                  {(() => {
                    let questions: KuisSoal[] = [];
                    try {
                      questions = item.konten ? JSON.parse(item.konten) : [];
                    } catch (e) {
                      questions = [];
                    }

                    const updateQuestion = (qIndex: number, field: keyof KuisSoal, value: any) => {
                      const newQuestions = [...questions];
                      newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
                      handleItemChange(index, 'konten', JSON.stringify(newQuestions));
                    };

                    const removeQuestion = (qIndex: number) => {
                      const newQuestions = [...questions];
                      newQuestions.splice(qIndex, 1);
                      handleItemChange(index, 'konten', JSON.stringify(newQuestions));
                    };

                    const addQuestion = () => {
                      const newQuestions = [...questions, {
                        pertanyaan: '',
                        opsi_a: '',
                        opsi_b: '',
                        opsi_c: '',
                        opsi_d: '',
                        kunci_jawaban: 'A',
                        bobot_nilai: 10
                      }];
                      handleItemChange(index, 'konten', JSON.stringify(newQuestions));
                    };

                    const handleQuestionImageUpload = (qIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 500000) {
                          toast.error('Ukuran gambar maksimal 500KB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          updateQuestion(qIndex, 'gambar', reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    };

                    return (
                      <div className="space-y-6">
                        {questions.map((q, qIndex) => (
                          <div key={qIndex} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 relative">
                            <button 
                              onClick={() => removeQuestion(qIndex)}
                              className="absolute top-4 right-4 text-red-500 hover:text-red-700 z-10"
                              title="Hapus Soal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="space-y-4 pr-8">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Soal {qIndex + 1}</label>
                                <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 mb-3">
                                  <ReactQuill
                                    theme="snow"
                                    value={q.pertanyaan}
                                    onChange={(content) => updateQuestion(qIndex, 'pertanyaan', content)}
                                    modules={{
                                      toolbar: [
                                        ['bold', 'italic', 'underline'],
                                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                        ['clean']
                                      ]
                                    }}
                                    placeholder="Tulis pertanyaan..."
                                    className="min-h-[100px]"
                                  />
                                </div>

                                {/* Question Image */}
                                <div className="mt-2">
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Gambar Soal (Opsional, Maks 500KB)</label>
                                  {q.gambar ? (
                                    <div className="relative inline-block">
                                      <img src={q.gambar} alt="Soal" className="h-32 rounded-md border border-gray-200 dark:border-gray-700" />
                                      <button 
                                        onClick={() => updateQuestion(qIndex, 'gambar', '')}
                                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-sm"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors w-fit">
                                      <ImageIcon className="w-4 h-4 text-gray-400" />
                                      <span className="text-xs text-gray-600 dark:text-gray-300">Upload Gambar</span>
                                      <input 
                                        type="file" 
                                        accept="image/png, image/jpeg" 
                                        className="hidden" 
                                        onChange={(e) => handleQuestionImageUpload(qIndex, e)}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {['a', 'b', 'c', 'd'].map((opt) => (
                                  <div key={opt}>
                                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Opsi {opt}</label>
                                    <input 
                                      type="text" 
                                      value={(q as any)[`opsi_${opt}`]} 
                                      onChange={(e) => updateQuestion(qIndex, `opsi_${opt}` as any, e.target.value)} 
                                      className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none" 
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className="flex flex-wrap items-center gap-6 pt-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-2">Kunci Jawaban</label>
                                  <div className="flex items-center space-x-4">
                                    {['A', 'B', 'C', 'D'].map((key) => (
                                      <label key={key} className="flex items-center space-x-1.5 cursor-pointer">
                                        <input 
                                          type="radio" 
                                          name={`kunci_${qIndex}`}
                                          value={key}
                                          checked={q.kunci_jawaban === key}
                                          onChange={() => updateQuestion(qIndex, 'kunci_jawaban', key)}
                                          className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{key}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Bobot Nilai</label>
                                  <input 
                                    type="number" 
                                    value={q.bobot_nilai} 
                                    onChange={(e) => updateQuestion(qIndex, 'bobot_nilai', Number(e.target.value))}
                                    className="w-24 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none" 
                                    min="1"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={addQuestion}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Tambah Soal
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {item.tipe_item === 'TUGAS' && (() => {
                let config = { allow_link: true, allow_file: false, allowed_extensions: [] as string[] };
                try {
                  if (item.konten) {
                    const parsed = JSON.parse(item.konten);
                    config = { ...config, ...parsed };
                  }
                } catch (e) {
                  // Ignore
                }

                const updateConfig = (field: string, value: any) => {
                  const newConfig = { ...config, [field]: value };
                  handleItemChange(index, 'konten', JSON.stringify(newConfig));
                };

                const toggleExtension = (ext: string) => {
                  const exts = config.allowed_extensions || [];
                  if (exts.includes(ext)) {
                    updateConfig('allowed_extensions', exts.filter(e => e !== ext));
                  } else {
                    updateConfig('allowed_extensions', [...exts, ext]);
                  }
                };

                return (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                        Atur jenis pengumpulan tugas yang diizinkan untuk siswa.
                      </p>
                      
                      <div className="space-y-3">
                        {!config.allow_link && !config.allow_file && (
                          <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 mb-2">
                            Peringatan: Anda harus mengizinkan setidaknya satu jenis pengumpulan (Link atau File).
                          </div>
                        )}
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.allow_link}
                            onChange={(e) => updateConfig('allow_link', e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Izinkan Pengumpulan Link (URL)</span>
                        </label>

                        <div>
                          <label className="flex items-center space-x-3 cursor-pointer mb-2">
                            <input
                              type="checkbox"
                              checked={config.allow_file}
                              onChange={(e) => updateConfig('allow_file', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Izinkan Upload File</span>
                          </label>
                          
                          {config.allow_file && (
                            <div className="ml-7 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Pilih format file yang diizinkan:</p>
                              <div className="flex flex-wrap gap-3">
                                {['pdf', 'doc,docx', 'xls,xlsx', 'ppt,pptx', 'jpg,jpeg,png', 'zip,rar'].map(ext => (
                                  <label key={ext} className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={(config.allowed_extensions || []).includes(ext)}
                                      onChange={() => toggleExtension(ext)}
                                      className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-700 dark:text-gray-300 uppercase">{ext.replace(/,/g, '/')}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={() => handleAddItem('MATERI')} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Materi Teks
          </button>
          <button onClick={() => handleAddItem('PDF')} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Dokumen PDF
          </button>
          <button onClick={() => handleAddItem('YOUTUBE')} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Video YouTube
          </button>
          <button onClick={() => handleAddItem('KUIS')} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Kuis/Soal
          </button>
          <button onClick={() => handleAddItem('TUGAS')} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Tugas Upload
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end space-x-4 z-10">
        <button
          onClick={() => handleSave(false)}
          disabled={loading}
          className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          Simpan Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
        >
          <Save className="w-5 h-5 mr-2" />
          Publikasikan Modul
        </button>
      </div>
    </div>
  );
}
