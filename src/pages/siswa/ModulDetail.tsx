import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, setDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, FileText, Youtube, CheckCircle, ChevronLeft, ChevronRight, PlayCircle, FileUp, ListChecks, Download, Lock, ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import 'react-quill-new/dist/quill.snow.css';
import { logActivity } from '../../utils/activity';

interface ModulItem {
  id: string;
  modul_id: string;
  tipe_item: 'MATERI' | 'PDF' | 'YOUTUBE' | 'KUIS' | 'TUGAS';
  judul_item: string;
  deskripsi: string;
  konten: string;
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

export default function ModulSiswaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [modul, setModul] = useState<any>(null);
  const [items, setItems] = useState<ModulItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [isPrerequisiteMet, setIsPrerequisiteMet] = useState(true);
  const [prerequisiteModul, setPrerequisiteModul] = useState<any>(null);
  
  // State for Kuis
  const [kuisAnswers, setKuisAnswers] = useState<Record<number, string>>({});
  const [kuisSubmitted, setKuisSubmitted] = useState(false);
  const [kuisScore, setKuisScore] = useState(0);

  // State for Tugas
  const [tugasLink, setTugasLink] = useState('');
  const [tugasFile, setTugasFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchModulData = async () => {
      if (!id || !profile) return;

      try {
        // Fetch Modul
        const modulDoc = await getDoc(doc(db, 'moduls', id));
        if (!modulDoc.exists()) {
          toast.error('Modul tidak ditemukan');
          navigate('/siswa/modul');
          return;
        }
        const currentModulData = modulDoc.data();
        setModul({ id: modulDoc.id, ...currentModulData });

        // Add user to viewers if not already present
        if (!currentModulData.viewers?.includes(profile.uid)) {
          try {
            await updateDoc(doc(db, 'moduls', id), {
              viewers: arrayUnion(profile.uid)
            });
          } catch (e) {
            console.error('Error updating viewers:', e);
          }
        }

        // Fetch Items
        const itemsRef = collection(db, 'modul_items');
        const q = query(itemsRef, where('modul_id', '==', id));
        const snapshot = await getDocs(q);
        const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ModulItem[];
        fetchedItems.sort((a, b) => a.urutan - b.urutan);
        setItems(fetchedItems);

        // Fetch Progress
        const progressRef = collection(db, 'progres_siswa');
        const qProgress = query(progressRef, where('modul_id', '==', id), where('siswa_id', '==', profile.uid));
        const snapshotProgress = await getDocs(qProgress);
        const fetchedProgress: Record<string, any> = {};
        snapshotProgress.docs.forEach(doc => {
          fetchedProgress[doc.data().modul_item_id] = doc.data();
        });
        setProgress(fetchedProgress);

        // Check Prerequisite
        if (currentModulData?.prasyarat_id) {
          const preDoc = await getDoc(doc(db, 'moduls', currentModulData.prasyarat_id));
          if (preDoc.exists()) {
            const preData = { id: preDoc.id, ...preDoc.data() };
            setPrerequisiteModul(preData);

            // Check if prerequisite is completed
            // 1. Get all items of prerequisite modul
            const preItemsRef = collection(db, 'modul_items');
            const qPreItems = query(preItemsRef, where('modul_id', '==', preData.id));
            const preItemsSnapshot = await getDocs(qPreItems);
            const preItemsCount = preItemsSnapshot.size;

            // 2. Get student's progress for prerequisite modul
            const preProgressRef = collection(db, 'progres_siswa');
            const qPreProgress = query(
              preProgressRef, 
              where('modul_id', '==', preData.id), 
              where('siswa_id', '==', profile.uid),
              where('status_selesai', '==', true)
            );
            const preProgressSnapshot = await getDocs(qPreProgress);
            const preCompletedCount = preProgressSnapshot.size;

            // 3. Check if all items are completed AND if there are quizzes/assignments, they must be graded
            // For simplicity, we check if completed count matches total count
            // and if there are any ungraded assignments
            let allGraded = true;
            const completedItems = preProgressSnapshot.docs.map(doc => doc.data());
            
            preItemsSnapshot.docs.forEach(itemDoc => {
              const item = itemDoc.data();
              const progressItem = completedItems.find(p => p.modul_item_id === itemDoc.id);
              
              if (!progressItem || !progressItem.status_selesai) {
                allGraded = false;
              } else if (item.tipe_item === 'TUGAS' && progressItem.nilai === undefined) {
                // If it's a task but has no grade yet
                allGraded = false;
              }
            });

            if (!allGraded) {
              setIsPrerequisiteMet(false);
            }
          }
        }

      } catch (error) {
        console.error('Error fetching modul:', error);
        toast.error('Gagal memuat modul');
      } finally {
        setLoading(false);
      }
    };

    fetchModulData();
  }, [id, profile, navigate]);

  useEffect(() => {
    // When currentIndex changes, check if we have progress for this item
    if (items.length > 0 && items[currentIndex]) {
      const currentItemId = items[currentIndex].id;
      const itemProgress = progress[currentItemId];
      
      if (itemProgress) {
        if (items[currentIndex].tipe_item === 'KUIS') {
          setKuisAnswers(itemProgress.jawaban || {});
          setKuisScore(itemProgress.nilai || 0);
          setKuisSubmitted(true);
        } else if (items[currentIndex].tipe_item === 'TUGAS') {
          setTugasLink(itemProgress.link_tugas || '');
          setTugasFile(null); // Can't easily restore file object
        }
      } else {
        // Reset state if no progress
        setKuisAnswers({});
        setKuisSubmitted(false);
        setTugasLink('');
        setTugasFile(null);
      }

      // Log activity when opening an item
      if (profile) {
        logActivity(
          profile.uid,
          profile.nama_lengkap,
          profile.kelas_id,
          `Membuka materi: ${items[currentIndex].judul_item}`,
          id,
          modul?.judul_modul
        );
      }
    }
  }, [currentIndex, items, progress, profile, id, modul]);

  const markAsCompleted = async () => {
    if (!profile || !id || !items[currentIndex]) return;
    
    try {
      const progressData = {
        siswa_id: profile.uid,
        modul_item_id: items[currentIndex].id,
        modul_id: id,
        status_selesai: true,
        selesai_pada: serverTimestamp()
      };
      await setDoc(doc(db, 'progres_siswa', `${profile.uid}_${items[currentIndex].id}`), progressData, { merge: true });
      
      setProgress(prev => ({
        ...prev,
        [items[currentIndex].id]: {
          ...prev[items[currentIndex].id],
          ...progressData
        }
      }));

      logActivity(
        profile.uid,
        profile.nama_lengkap,
        profile.kelas_id,
        `Menyelesaikan materi: ${items[currentIndex].judul_item}`,
        id,
        modul?.judul_modul
      );
    } catch (error) {
      console.error('Error marking as completed:', error);
    }
  };

  const handleNext = async () => {
    // Mark current item as completed if it's not a KUIS or TUGAS (which have their own submit buttons)
    if (items[currentIndex].tipe_item !== 'KUIS' && items[currentIndex].tipe_item !== 'TUGAS') {
      await markAsCompleted();
    }

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.success('Selamat! Anda telah menyelesaikan modul ini.');
      navigate('/siswa/modul');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const submitKuis = async (questions: KuisSoal[]) => {
    let score = 0;
    let totalBobot = 0;

    questions.forEach((q, index) => {
      totalBobot += q.bobot_nilai;
      if (kuisAnswers[index] === q.kunci_jawaban) {
        score += q.bobot_nilai;
      }
    });

    const finalScore = totalBobot > 0 ? Math.round((score / totalBobot) * 100) : 0;
    setKuisScore(finalScore);
    setKuisSubmitted(true);

    // Save progress to Firestore (Optional, implement if needed)
    try {
      const progressData = {
        siswa_id: profile?.uid,
        modul_item_id: items[currentIndex].id,
        modul_id: id,
        status_selesai: true,
        nilai: finalScore,
        jawaban: kuisAnswers,
        selesai_pada: serverTimestamp()
      };
      await setDoc(doc(db, 'progres_siswa', `${profile?.uid}_${items[currentIndex].id}`), progressData);
      
      // Update local progress state
      setProgress(prev => ({
        ...prev,
        [items[currentIndex].id]: progressData
      }));
      
      logActivity(
        profile!.uid,
        profile!.nama_lengkap,
        profile!.kelas_id,
        `Mengerjakan kuis: ${items[currentIndex].judul_item} (Nilai: ${finalScore})`,
        id,
        modul?.judul_modul
      );

      toast.success(`Kuis selesai! Nilai Anda: ${finalScore}`);
    } catch (error) {
      console.error('Error saving kuis progress:', error);
      toast.error('Gagal menyimpan nilai kuis');
    }
  };

  const submitTugas = async () => {
    let config = { allow_link: true, allow_file: false, allowed_extensions: [] as string[] };
    try {
      if (items[currentIndex].konten) {
        const parsed = JSON.parse(items[currentIndex].konten);
        config = { ...config, ...parsed };
      }
    } catch (e) {
      // Ignore
    }

    const hasExistingFile = !!progress[items[currentIndex].id]?.file_submission;

    if (config.allow_link && config.allow_file) {
      if (!tugasLink.trim() && !tugasFile && !hasExistingFile) {
        toast.error('Masukkan link tugas atau upload file');
        return;
      }
    } else if (config.allow_link && !tugasLink.trim()) {
      toast.error('Masukkan link tugas terlebih dahulu');
      return;
    } else if (config.allow_file && !tugasFile && !hasExistingFile) {
      toast.error('Upload file tugas terlebih dahulu');
      return;
    }

    // Validate file extension
    if (tugasFile && config.allowed_extensions && config.allowed_extensions.length > 0) {
      const ext = tugasFile.name.split('.').pop()?.toLowerCase() || '';
      let isAllowed = false;
      for (const allowedExt of config.allowed_extensions) {
        const exts = allowedExt.split(',');
        if (exts.includes(ext)) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed) {
        toast.error(`Format file tidak diizinkan. Ekstensi yang diizinkan: ${config.allowed_extensions.join(', ')}`);
        return;
      }
    }

    try {
      // Simulate file upload by creating a fake URL or storing the file name
      // In a real app, you would upload to Firebase Storage here
      const fileSubmissionUrl = tugasFile ? `https://storage.example.com/fake-path/${tugasFile.name}` : null;

      const progressData: any = {
        siswa_id: profile?.uid,
        modul_item_id: items[currentIndex].id,
        modul_id: id,
        status_selesai: true,
        selesai_pada: serverTimestamp()
      };

      if (tugasLink.trim()) {
        progressData.link_tugas = tugasLink;
      }
      if (fileSubmissionUrl) {
        progressData.file_submission = fileSubmissionUrl;
      }

      await setDoc(doc(db, 'progres_siswa', `${profile?.uid}_${items[currentIndex].id}`), progressData, { merge: true });
      
      // Update local progress state
      setProgress(prev => ({
        ...prev,
        [items[currentIndex].id]: progressData
      }));
      
      logActivity(
        profile!.uid,
        profile!.nama_lengkap,
        profile!.kelas_id,
        `Mengumpulkan tugas: ${items[currentIndex].judul_item}`,
        id,
        modul?.judul_modul
      );

      toast.success('Tugas berhasil dikumpulkan');
      handleNext();
    } catch (error) {
      console.error('Error saving tugas:', error);
      toast.error('Gagal mengumpulkan tugas');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!modul || items.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Modul Kosong</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Modul ini belum memiliki konten pembelajaran.</p>
        <button onClick={() => navigate('/siswa/modul')} className="text-blue-600 hover:underline">
          Kembali ke Daftar Modul
        </button>
      </div>
    );
  }

  if (!isPrerequisiteMet) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 border border-gray-100 dark:border-gray-700">
          <div className="w-20 h-20 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <PlayCircle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Modul Terkunci</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Anda harus menyelesaikan modul prasyarat: <span className="font-bold text-blue-600 dark:text-blue-400">"{prerequisiteModul?.judul_modul}"</span> terlebih dahulu sebelum dapat mengakses modul ini.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate(`/siswa/modul/${prerequisiteModul?.id}`)}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
            >
              Buka Modul Prasyarat
            </button>
            <button 
              onClick={() => navigate('/siswa/modul')}
              className="w-full sm:w-auto px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              Kembali ke Daftar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex];

  const renderContent = () => {
    switch (currentItem.tipe_item) {
      case 'MATERI':
        return (
          <div className="prose dark:prose-invert max-w-none">
            <div 
              className="text-gray-700 dark:text-gray-300 ql-editor !p-0"
              dangerouslySetInnerHTML={{ __html: currentItem.konten }}
            />
          </div>
        );
      case 'PDF':
        return (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
            <FileText className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Dokumen PDF</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
              Silakan unduh atau buka dokumen PDF ini untuk mempelajari materi lebih lanjut.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a 
                href={currentItem.konten} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-xl shadow-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:scale-105 active:scale-95"
              >
                <ExternalLinkIcon className="w-5 h-5 mr-2" />
                Buka Dokumen PDF
              </a>
              <a 
                href={currentItem.konten} 
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-semibold rounded-xl shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all hover:scale-105 active:scale-95"
              >
                <Download className="w-5 h-5 mr-2" />
                Unduh PDF
              </a>
            </div>
          </div>
        );
      case 'YOUTUBE':
        // Extract video ID
        let videoId = '';
        try {
          const url = new URL(currentItem.konten);
          if (url.hostname.includes('youtube.com')) {
            videoId = url.searchParams.get('v') || '';
          } else if (url.hostname.includes('youtu.be')) {
            videoId = url.pathname.slice(1);
          }
        } catch (e) {
          console.error('Invalid YouTube URL');
        }

        return (
          <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden bg-black">
            {videoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full min-h-[400px]"
              ></iframe>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px] text-gray-500">
                URL Video Tidak Valid
              </div>
            )}
          </div>
        );
      case 'KUIS':
        let questions: KuisSoal[] = [];
        try {
          questions = JSON.parse(currentItem.konten);
        } catch (e) {
          questions = [];
        }

        if (questions.length === 0) {
          return <div className="text-center py-8 text-gray-500">Belum ada soal untuk kuis ini.</div>;
        }

        return (
          <div className="space-y-8">
            {kuisSubmitted ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-8 rounded-xl border border-green-200 dark:border-green-800 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">Kuis Selesai!</h3>
                <p className="text-lg text-green-700 dark:text-green-300 mb-6">Nilai Anda: <span className="font-bold text-3xl">{kuisScore}</span> / 100</p>
                <button
                  onClick={handleNext}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Lanjutkan ke Tahap Berikutnya
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q, qIndex) => (
                  <div key={qIndex} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col space-y-4 mb-6">
                      <div className="flex items-start space-x-3">
                        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full font-bold">
                          {qIndex + 1}
                        </span>
                        <div 
                          className="text-lg font-medium text-gray-900 dark:text-white ql-editor !p-0"
                          dangerouslySetInnerHTML={{ __html: q.pertanyaan }}
                        />
                      </div>
                      
                      {q.gambar && (
                        <div className="ml-11">
                          <img 
                            src={q.gambar} 
                            alt={`Gambar Soal ${qIndex + 1}`} 
                            className="max-h-64 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 ml-11">
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const optionKey = `opsi_${opt.toLowerCase()}` as keyof KuisSoal;
                        return (
                          <label 
                            key={opt} 
                            className={`flex items-center p-4 rounded-lg border cursor-pointer transition-colors ${
                              kuisAnswers[qIndex] === opt 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500' 
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${qIndex}`}
                              value={opt}
                              checked={kuisAnswers[qIndex] === opt}
                              onChange={() => setKuisAnswers({ ...kuisAnswers, [qIndex]: opt })}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="ml-3 block text-sm font-medium text-gray-900 dark:text-gray-300">
                              <span className="font-bold mr-2">{opt}.</span> {q[optionKey]}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => submitKuis(questions)}
                    disabled={Object.keys(kuisAnswers).length < questions.length}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Kumpulkan Jawaban
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      case 'TUGAS':
        let config = { allow_link: true, allow_file: false, allowed_extensions: [] as string[] };
        try {
          if (items[currentIndex].konten) {
            const parsed = JSON.parse(items[currentIndex].konten);
            config = { ...config, ...parsed };
          }
        } catch (e) {
          // Ignore
        }

        const acceptString = config.allowed_extensions && config.allowed_extensions.length > 0 
          ? config.allowed_extensions.map(ext => `.${ext.replace(/,/g, ',.')}`).join(',') 
          : '*/*';

        return (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center mb-4 text-blue-600 dark:text-blue-400">
              <FileUp className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium">Pengumpulan Tugas</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Silakan kerjakan tugas sesuai instruksi dan kumpulkan hasil pekerjaan Anda di bawah ini.
            </p>
            
            <div className="space-y-6">
              {config.allow_link && (
                <div>
                  <label htmlFor="tugasLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Link Tugas {config.allow_file && '(Opsional jika sudah upload file)'}
                  </label>
                  <input
                    type="url"
                    id="tugasLink"
                    value={tugasLink}
                    onChange={(e) => setTugasLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                  />
                </div>
              )}

              {config.allow_file && (
                <div>
                  <label htmlFor="tugasFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Upload File {config.allow_link && '(Opsional jika sudah mengisi link)'}
                  </label>
                  {progress[items[currentIndex]?.id]?.file_submission && !tugasFile && (
                    <div className="mb-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center">
                      <FileUp className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                      <span className="text-sm text-green-700 dark:text-green-300">File sudah diunggah. Upload file baru untuk mengganti.</span>
                    </div>
                  )}
                  <input
                    type="file"
                    id="tugasFile"
                    accept={acceptString}
                    onChange={(e) => setTugasFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                  />
                  {config.allowed_extensions && config.allowed_extensions.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Format yang diizinkan: {config.allowed_extensions.join(', ').replace(/,/g, '/').toUpperCase()}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={submitTugas}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Kumpulkan Tugas
              </button>
            </div>
          </div>
        );
      default:
        return <div>Tipe konten tidak didukung.</div>;
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'MATERI': return <BookOpen className="w-5 h-5" />;
      case 'PDF': return <FileText className="w-5 h-5" />;
      case 'YOUTUBE': return <Youtube className="w-5 h-5" />;
      case 'KUIS': return <ListChecks className="w-5 h-5" />;
      case 'TUGAS': return <FileUp className="w-5 h-5" />;
      default: return <BookOpen className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      <div className="w-full md:w-64 shrink-0 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
          <button 
            onClick={() => navigate('/siswa/modul')}
            className="flex items-center text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
          </button>
          {modul.ikon && (
            <div className="w-full aspect-video mb-4 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
              <img src={modul.ikon} alt={modul.judul_modul} className="w-full h-full object-cover" />
            </div>
          )}
          <h2 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">{modul.judul_modul}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 mb-4">
            {modul.mata_pelajaran}
          </span>
          
          <div className="space-y-1">
            {items.map((item, idx) => {
              const isCompleted = progress[item.id]?.status_selesai;
              const isActive = currentIndex === idx;
              const isAccessible = idx === 0 || progress[items[idx - 1].id]?.status_selesai;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isAccessible) {
                      setCurrentIndex(idx);
                    } else {
                      toast.error('Selesaikan tahapan sebelumnya terlebih dahulu');
                    }
                  }}
                  disabled={!isAccessible}
                  className={`w-full flex items-center p-3 text-sm rounded-xl transition-all text-left group ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none font-semibold scale-[1.02]' 
                      : isAccessible
                        ? 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
                        : 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <div className={`mr-3 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isCompleted 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-500' 
                        : isAccessible 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : isAccessible ? (
                      <PlayCircle className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.judul_item}</div>
                    <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                      {item.tipe_item}
                    </div>
                  </div>
                  {!isAccessible && (
                    <div className="ml-2">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Progress Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tahap {currentIndex + 1} dari {items.length}
            </span>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {Math.round((Object.keys(progress).length / items.length) * 100)}% Selesai
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${(Object.keys(progress).length / items.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="border-b border-gray-100 dark:border-gray-700 p-6 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg mr-3">
                {getIconForType(currentItem.tipe_item)}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentItem.judul_item}
              </h2>
            </div>
            {currentItem.deskripsi && (
              <p className="text-gray-600 dark:text-gray-400 mt-2 ml-11">
                {currentItem.deskripsi}
              </p>
            )}
          </div>
          
          <div className="p-6 md:p-8">
            {renderContent()}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="sticky bottom-4 left-0 right-0 z-20 mt-8">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-xl flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Sebelumnya
            </button>
            
            <div className="hidden sm:flex items-center space-x-1">
              {items.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex 
                      ? 'w-8 bg-blue-600 dark:bg-blue-400' 
                      : progress[items[idx].id]?.status_selesai 
                        ? 'w-2 bg-green-500 dark:bg-green-400' 
                        : 'w-2 bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={
                (currentItem.tipe_item === 'KUIS' || currentItem.tipe_item === 'TUGAS') && 
                !progress[currentItem.id]?.status_selesai
              }
              className={`flex items-center px-6 py-2 text-sm font-semibold text-white border border-transparent rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 ${
                currentIndex === items.length - 1
                  ? 'bg-green-600 hover:bg-green-700 shadow-green-200 dark:shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {currentIndex === items.length - 1 ? (
                <>Selesai <CheckCircle className="w-5 h-5 ml-2" /></>
              ) : (
                <>Selanjutnya <ChevronRight className="w-5 h-5 ml-2" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
