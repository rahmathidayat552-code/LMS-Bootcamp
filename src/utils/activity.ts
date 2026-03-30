import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const logActivity = async (
  userId: string,
  namaSiswa: string,
  kelasId: string,
  aksi: string,
  modulId?: string,
  modulJudul?: string
) => {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      user_id: userId,
      nama_siswa: namaSiswa,
      kelas_id: kelasId || 'TIDAK_ADA_KELAS',
      aksi,
      modul_id: modulId || null,
      modul_judul: modulJudul || null,
      created_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};
