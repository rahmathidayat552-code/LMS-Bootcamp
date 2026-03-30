import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, GripVertical, ArrowUp, ArrowDown, Image as ImageIcon, X, Search, Youtube, ExternalLink, ChevronLeft, ChevronRight, BookOpen, Users } from 'lucide-react';
import { toast } from 'sonner';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { GoogleGenAI, Type } from "@google/genai";

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
  'list',
  'link', 'blockquote', 'code-block'
];

const quizQuillModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['clean']
  ]
};

const quizQuillFormats = [
  'bold', 'italic', 'underline', 'list'
];

export default function ModulForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSidebarOpen } = useOutletContext<{ isSidebarOpen: boolean }>();
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
  const [prasyaratId, setPrasyaratId] = useState<string>('');
  
  const [items, setItems] = useState<ModulItem[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Data State
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [existingModuls, setExistingModuls] = useState<any[]>([]);
  
  // YouTube Search State
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchYouTube = async (query: string) => {
    if (!query) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Lakukan pencarian Google Search dengan query: "site:youtube.com ${query}".\nAmbil 5 hasil pencarian video YouTube teratas.\nKembalikan dalam format JSON array dengan objek yang memiliki properti:\n- 'title': Judul video\n- 'url': URL video YouTube yang benar-benar valid (harus persis sama dengan URL di hasil pencarian)\n- 'thumbnail': URL thumbnail YouTube (biasanya https://i.ytimg.com/vi/<VIDEO_ID>/hqdefault.jpg)\n\nSangat penting: JANGAN mengarang URL. Hanya gunakan URL yang benar-benar dikembalikan oleh Google Search.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING },
                thumbnail: { type: Type.STRING }
              },
              required: ["title", "url"]
            }
          }
        }
      });
      
      let results = JSON.parse(response.text || '[]');
      if (!Array.isArray(results)) results = [];
      
      // Extract video ID helper
      const extractVideoId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        return match ? match[1] : null;
      };

      // Verify with grounding chunks if available to ensure URLs are real
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        const validUrls = chunks.map(c => c.web?.uri).filter(Boolean) as string[];
        const validIds = new Set(validUrls.map(extractVideoId).filter(Boolean));
        
        if (validIds.size > 0) {
          // Filter JSON results to only include those with valid IDs from search
          results = results.filter((r: any) => {
            const id = extractVideoId(r.url);
            return id && validIds.has(id);
          });
          
          // If JSON results were all filtered out (hallucinated), fallback to building from chunks
          if (results.length === 0) {
            const extractedFromChunks = chunks
              .filter(c => c.web?.uri && extractVideoId(c.web.uri))
              .map(c => {
                const videoId = extractVideoId(c.web!.uri!);
                return {
                  title: c.web!.title || 'Video YouTube',
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                };
              });
              
            // Remove duplicates
            const seen = new Set();
            results = extractedFromChunks.filter(r => {
              if (seen.has(r.url)) return false;
              seen.add(r.url);
              return true;
            });
          }
        }
      } else {
        // If no grounding chunks, at least ensure the URLs look like valid YouTube URLs
        results = results.filter((r: any) => extractVideoId(r.url));
      }

      setSearchResults(results);
      if (results.length === 0) {
        toast.info('Tidak ada hasil video valid yang ditemukan');
      }
    } catch (error) {
      console.error('YouTube Search Error:', error);
      toast.error('Gagal mencari video YouTube');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check for prerequisite from URL
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const preId = params.get('prasyarat');
        if (preId && !isEditing) {
          setPrasyaratId(preId);
          // Fetch the prerequisite module to pre-fill some fields
          const preDoc = await getDoc(doc(db, 'moduls', preId));
          if (preDoc.exists()) {
            const preData = preDoc.data();
            setMataPelajaran(preData.mata_pelajaran || '');
            setTipeTarget(preData.tipe_target || 'KELAS');
            setTargetKelasIds(preData.target_kelas_ids || []);
            setTargetSiswaIds(preData.target_siswa_ids || []);
          }
        }

        // Fetch Kelas
        const kelasSnapshot = await getDocs(collection(db, 'kelas'));
        setKelasList(kelasSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kelas)));

        // Fetch Siswa
        const siswaQuery = query(collection(db, 'users'), where('role', '==', 'SISWA'));
        const siswaSnapshot = await getDocs(siswaQuery);
        setSiswaList(siswaSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Siswa)));

        // Fetch Existing Moduls for Prerequisite
        const modulsQuery = query(collection(db, 'moduls'), where('guru_id', '==', user?.uid));
        const modulsSnapshot = await getDocs(modulsQuery);
        setExistingModuls(modulsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

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
            setPrasyaratId(data.prasyarat_id || '');

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

  useEffect(() => {
    if (prasyaratId && existingModuls.length > 0) {
      const preModul = existingModuls.find(m => m.id === prasyaratId);
      if (preModul) {
        setMataPelajaran(preModul.mata_pelajaran || '');
        setTipeTarget(preModul.tipe_target || 'KELAS');
        setTargetKelasIds(preModul.target_kelas_ids || []);
        setTargetSiswaIds(preModul.target_siswa_ids || []);
      }
    }
  }, [prasyaratId, existingModuls]);

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
    setCurrentStepIndex(items.length); // Move to the newly added item
  };

  const handleRemoveItem = (index: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus tahapan ini?')) {
      const newItems = [...items];
      newItems.splice(index, 1);
      // Reorder
      newItems.forEach((item, i) => {
        item.urutan = i + 1;
      });
      setItems(newItems);
      if (currentStepIndex >= newItems.length) {
        setCurrentStepIndex(Math.max(0, newItems.length - 1));
      }
      toast.success('Tahapan berhasil dihapus');
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
        prasyarat_id: prasyaratId,
        is_published: publish,
        created_at: new Date().toISOString() // ISO string for DB
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
          created_at: new Date().toISOString() // ISO string for DB
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
        <div className="space-y-4 border-b border-gray-100 dark:border-gray-700 pb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modul Prasyarat (Opsional)</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Siswa harus menyelesaikan modul ini sebelum bisa membuka modul yang sedang Anda buat.</p>
          <select
            value={prasyaratId}
            onChange={(e) => setPrasyaratId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Tanpa Prasyarat --</option>
            {existingModuls
              .filter(m => m.id !== id) // Don't allow self as prerequisite
              .map(m => (
                <option key={m.id} value={m.id}>{m.judul_modul} ({m.mata_pelajaran})</option>
              ))
            }
          </select>
        </div>

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
              <div className="relative">
                <input
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  disabled={!!prasyaratId}
                  className={`w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${prasyaratId ? 'opacity-70 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50 border-blue-200 dark:border-blue-900/50' : ''}`}
                  placeholder="Contoh: Pemrograman Dasar"
                />
                {prasyaratId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <BookOpen className="w-4 h-4 text-blue-500 opacity-50" />
                  </div>
                )}
              </div>
              {prasyaratId && <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 italic flex items-center"><Search className="w-3 h-3 mr-1" /> Mata pelajaran dikunci sesuai modul prasyarat</p>}
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
            <label className={`flex items-center space-x-2 ${prasyaratId ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
              <input
                type="radio"
                checked={tipeTarget === 'KELAS'}
                onChange={() => setTipeTarget('KELAS')}
                disabled={!!prasyaratId}
                className="text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm dark:text-gray-300">Pilih Kelas</span>
            </label>
            <label className={`flex items-center space-x-2 ${prasyaratId ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
              <input
                type="radio"
                checked={tipeTarget === 'SISWA'}
                onChange={() => setTipeTarget('SISWA')}
                disabled={!!prasyaratId}
                className="text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm dark:text-gray-300">Pilih Siswa Tertentu</span>
            </label>
          </div>

          {tipeTarget === 'KELAS' ? (
            <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 transition-opacity ${prasyaratId ? 'opacity-70 ring-1 ring-blue-100 dark:ring-blue-900/30' : ''}`}>
              {kelasList.map(kelas => (
                <label key={kelas.id} className={`flex items-center space-x-3 mb-2 last:mb-0 ${prasyaratId ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={targetKelasIds.includes(kelas.id)}
                    onChange={(e) => {
                      if (e.target.checked) setTargetKelasIds([...targetKelasIds, kelas.id]);
                      else setTargetKelasIds(targetKelasIds.filter(id => id !== kelas.id));
                    }}
                    disabled={!!prasyaratId}
                    className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={`text-sm ${targetKelasIds.includes(kelas.id) && prasyaratId ? 'text-blue-700 dark:text-blue-300 font-medium' : 'dark:text-gray-300'}`}>
                    {kelas.tingkat} {kelas.nama_kelas}
                  </span>
                </label>
              ))}
              {kelasList.length === 0 && <p className="text-sm text-gray-500">Belum ada data kelas.</p>}
            </div>
          ) : (
            <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 transition-opacity ${prasyaratId ? 'opacity-70 ring-1 ring-blue-100 dark:ring-blue-900/30' : ''}`}>
              {siswaList.map(siswa => (
                <label key={siswa.id} className={`flex items-center space-x-3 mb-2 last:mb-0 ${prasyaratId ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={targetSiswaIds.includes(siswa.id)}
                    onChange={(e) => {
                      if (e.target.checked) setTargetSiswaIds([...targetSiswaIds, siswa.id]);
                      else setTargetSiswaIds(targetSiswaIds.filter(id => id !== siswa.id));
                    }}
                    disabled={!!prasyaratId}
                    className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={`text-sm ${targetSiswaIds.includes(siswa.id) && prasyaratId ? 'text-blue-700 dark:text-blue-300 font-medium' : 'dark:text-gray-300'}`}>
                    {siswa.nama_lengkap}
                  </span>
                </label>
              ))}
              {siswaList.length === 0 && <p className="text-sm text-gray-500">Belum ada data siswa.</p>}
            </div>
          )}
          {prasyaratId && (
            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 italic flex items-center">
              <Users className="w-3 h-3 mr-1" /> Target peserta dikunci sesuai modul prasyarat
            </p>
          )}
        </div>

      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tahapan Belajar</h2>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {items.length > 0 ? `Tahap ${currentStepIndex + 1} dari ${items.length}` : 'Belum ada tahapan'}
          </div>
        </div>
        
        {items.length > 0 ? (
          <div className="relative">
            {currentStepIndex > 0 && (
              <button 
                onClick={() => setCurrentStepIndex(currentStepIndex - 1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 w-10 h-10 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-600 z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {currentStepIndex < items.length - 1 && (
              <button 
                onClick={() => setCurrentStepIndex(currentStepIndex + 1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 w-10 h-10 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-600 z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {(() => {
                const item = items[currentStepIndex];
                const index = currentStepIndex;
                return (
                  <div key={item.id}>
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
                        value={item.konten || ''}
                        onChange={(content, delta, source) => {
                          if (content === item.konten) return;
                          if (source === 'user') {
                            handleItemChange(index, 'konten', content);
                          } else {
                            setTimeout(() => handleItemChange(index, 'konten', content), 0);
                          }
                        }}
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
                      value={item.konten || ''}
                      onChange={(e) => handleItemChange(index, 'konten', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://contoh.com/dokumen.pdf"
                    />
                    <p className="text-xs text-gray-500 mt-1">Masukkan link langsung ke file PDF (Google Drive, dll).</p>
                  </div>
                )}
  
                {item.tipe_item === 'YOUTUBE' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link Video YouTube</label>
                      <input
                        type="url"
                        value={item.konten || ''}
                        onChange={(e) => handleItemChange(index, 'konten', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
  
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <label className="block text-xs font-medium text-gray-500 mb-2 uppercase">Cari Video di YouTube</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Ketik judul video..."
                            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                searchYouTube(e.currentTarget.value);
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            const input = e.currentTarget.parentElement?.querySelector('input');
                            if (input) searchYouTube(input.value);
                          }}
                          disabled={isSearching}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                          <Youtube className="w-4 h-4" />
                          {isSearching ? 'Mencari...' : 'Cari'}
                        </button>
                      </div>
  
                      {searchResults.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                          {searchResults.map((result, rIndex) => (
                            <div 
                              key={rIndex}
                              className="flex gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm transition-all"
                            >
                              <div className="relative w-24 h-14 flex-shrink-0">
                                {result.thumbnail ? (
                                  <img src={result.thumbnail} alt="" className="w-full h-full object-cover rounded" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                    <Youtube className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                  <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1">{result.title}</p>
                                  <p className="text-[10px] text-gray-500 truncate">{result.url}</p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItemChange(index, 'konten', result.url);
                                      setSearchResults([]);
                                    }}
                                    className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded transition-colors"
                                  >
                                    Pilih
                                  </button>
                                  <a
                                    href={result.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center py-1 px-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Tonton
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
                                      value={q.pertanyaan || ''}
                                      onChange={(content, delta, source) => {
                                        if (content === q.pertanyaan) return;
                                        if (source === 'user') {
                                          updateQuestion(qIndex, 'pertanyaan', content);
                                        } else {
                                          setTimeout(() => updateQuestion(qIndex, 'pertanyaan', content), 0);
                                        }
                                      }}
                                      modules={quizQuillModules}
                                      formats={quizQuillFormats}
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
                                        value={(q as any)[`opsi_${opt}`] || ''} 
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
              
              {/* Slide Navigation Footer */}
              <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <button
                        onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                        disabled={currentStepIndex === 0}
                        className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {currentStepIndex + 1} / {items.length}
                      </span>
                      <button
                        onClick={() => setCurrentStepIndex(Math.min(items.length - 1, currentStepIndex + 1))}
                        disabled={currentStepIndex === items.length - 1}
                        className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Selanjutnya <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Belum ada tahapan belajar. Silakan tambahkan tahapan di bawah.</p>
          </div>
        )}

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

      <div className={`fixed bottom-0 left-0 right-0 ${isSidebarOpen ? 'md:left-64' : 'left-0'} bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end space-x-4 z-10 transition-all duration-300 ease-in-out`}>
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
