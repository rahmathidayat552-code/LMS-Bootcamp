import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export interface Kelas {
  id: string;
  nama_kelas: string;
  tingkat: number;
}

export interface Siswa {
  id: string;
  nama_lengkap: string;
  kelas_id?: string;
}

export interface ModulItem {
  id: string;
  tipe_item: 'MATERI' | 'PDF' | 'YOUTUBE' | 'KUIS' | 'TUGAS';
  judul_item: string;
  deskripsi: string;
  konten: string;
  urutan: number;
  wajib_feedback?: boolean;
  pertanyaan_feedback?: string;
}

export interface KuisSoal {
  pertanyaan: string;
  gambar?: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  kunci_jawaban: 'A' | 'B' | 'C' | 'D';
  bobot_nilai: number;
}

export function useModulForm(id: string | undefined) {
  const isEditing = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();

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
  
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const preId = params.get('prasyarat');
        if (preId && !isEditing) {
          setPrasyaratId(preId);
          const preDoc = await getDoc(doc(db, 'moduls', preId));
          if (preDoc.exists()) {
            const preData = preDoc.data();
            setMataPelajaran(preData.mata_pelajaran || '');
            setTipeTarget(preData.tipe_target || 'KELAS');
            setTargetKelasIds(preData.target_kelas_ids || []);
            setTargetSiswaIds(preData.target_siswa_ids || []);
          }
        }

        const kelasSnapshot = await getDocs(collection(db, 'kelas'));
        setKelasList(kelasSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Kelas)));

        const siswaQuery = query(collection(db, 'users'), where('role', '==', 'SISWA'));
        const siswaSnapshot = await getDocs(siswaQuery);
        setSiswaList(siswaSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Siswa)));

        const modulsQuery = query(collection(db, 'moduls'), where('guru_id', '==', user?.uid));
        const modulsSnapshot = await getDocs(modulsQuery);
        setExistingModuls(modulsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

        if (isEditing && id) {
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
  }, [id, isEditing, user]);

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
      urutan: items.length + 1,
      wajib_feedback: true,
      pertanyaan_feedback: ''
    };
    setItems([...items, newItem]);
    setCurrentStepIndex(items.length);
  };

  const handleRemoveItem = (index: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus tahapan ini?')) {
      const newItems = [...items];
      newItems.splice(index, 1);
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

  const handleItemChange = (index: number, field: keyof ModulItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const validateForm = () => {
    if (!judulModul.trim()) return 'Judul modul harus diisi';
    if (!mataPelajaran.trim()) return 'Mata pelajaran harus diisi';
    if (tipeTarget === 'KELAS' && targetKelasIds.length === 0) return 'Pilih minimal satu kelas target';
    if (tipeTarget === 'SISWA' && targetSiswaIds.length === 0) return 'Pilih minimal satu siswa target';
    if (items.length === 0) return 'Modul harus memiliki minimal satu tahapan';

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.judul_item.trim()) return `Judul tahapan ${i + 1} harus diisi`;
      if (!item.konten.trim() && item.tipe_item !== 'TUGAS') return `Konten tahapan ${i + 1} harus diisi`;
      if (item.tipe_item === 'KUIS') {
        try {
          const soalList = JSON.parse(item.konten);
          if (!Array.isArray(soalList) || soalList.length === 0) {
            return `Kuis pada tahapan ${i + 1} harus memiliki minimal satu soal`;
          }
        } catch (e) {
          return `Format kuis pada tahapan ${i + 1} tidak valid`;
        }
      }
    }
    return null;
  };

  const handleSave = async (publish: boolean) => {
    if (!user) return;

    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const modulRef = isEditing ? doc(db, 'moduls', id) : doc(collection(db, 'moduls'));
      
      const modulData = {
        judul_modul: judulModul,
        mata_pelajaran: mataPelajaran,
        deskripsi,
        tipe_target: tipeTarget,
        target_kelas_ids: tipeTarget === 'KELAS' ? targetKelasIds : [],
        target_siswa_ids: tipeTarget === 'SISWA' ? targetSiswaIds : [],
        is_published: publish,
        ikon,
        prasyarat_id: prasyaratId || null,
        guru_id: user.uid,
        updated_at: new Date().toISOString()
      };

      if (!isEditing) {
        Object.assign(modulData, { created_at: new Date().toISOString() });
        batch.set(modulRef, modulData);
      } else {
        batch.update(modulRef, modulData);
      }

      let oldItemIds: string[] = [];
      if (isEditing) {
        const oldItemsQuery = query(collection(db, 'modul_items'), where('modul_id', '==', id));
        const oldItemsSnapshot = await getDocs(oldItemsQuery);
        oldItemIds = oldItemsSnapshot.docs.map(doc => doc.id);
      }

      items.forEach((item, index) => {
        const isNewItem = !item.id || item.id.startsWith('temp_');
        const itemRef = isNewItem 
          ? doc(collection(db, 'modul_items')) 
          : doc(db, 'modul_items', item.id);

        const itemData: any = {
          modul_id: modulRef.id,
          tipe_item: item.tipe_item,
          judul_item: item.judul_item,
          deskripsi: item.deskripsi,
          konten: item.konten,
          urutan: index + 1,
          wajib_feedback: item.wajib_feedback ?? false,
          pertanyaan_feedback: item.pertanyaan_feedback || '',
          updated_at: new Date().toISOString()
        };

        if (isNewItem) {
          itemData.created_at = new Date().toISOString();
          batch.set(itemRef, itemData);
        } else {
          batch.update(itemRef, itemData);
          oldItemIds = oldItemIds.filter(oldId => oldId !== item.id);
        }
      });

      // Delete items that were removed by the user
      oldItemIds.forEach(oldId => {
        batch.delete(doc(db, 'modul_items', oldId));
      });

      await batch.commit();

      if (publish) {
        setShowPublishSuccess(true);
      } else {
        toast.success(isEditing ? 'Modul berhasil diperbarui' : 'Modul berhasil disimpan sebagai draft');
        navigate('/guru/modul');
      }
    } catch (error) {
      console.error('Error saving modul:', error);
      toast.error('Gagal menyimpan modul');
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
}
