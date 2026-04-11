import React from 'react';
import { BookOpen, Users, CheckCircle } from 'lucide-react';
import { Kelas, Siswa } from './hooks/useModulForm';

interface ModulFormHeaderProps {
  judulModul: string;
  setJudulModul: (val: string) => void;
  mataPelajaran: string;
  setMataPelajaran: (val: string) => void;
  deskripsi: string;
  setDeskripsi: (val: string) => void;
  tipeTarget: 'KELAS' | 'SISWA';
  setTipeTarget: (val: 'KELAS' | 'SISWA') => void;
  targetKelasIds: string[];
  setTargetKelasIds: (val: string[]) => void;
  targetSiswaIds: string[];
  setTargetSiswaIds: (val: string[]) => void;
  kelasList: Kelas[];
  siswaList: Siswa[];
  prasyaratId: string;
  setPrasyaratId: (val: string) => void;
  existingModuls: any[];
  ikon: string | null;
  setIkon: (val: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export default function ModulFormHeader({
  judulModul, setJudulModul,
  mataPelajaran, setMataPelajaran,
  deskripsi, setDeskripsi,
  tipeTarget, setTipeTarget,
  targetKelasIds, setTargetKelasIds,
  targetSiswaIds, setTargetSiswaIds,
  kelasList, siswaList,
  prasyaratId, setPrasyaratId,
  existingModuls,
  ikon, setIkon,
  fileInputRef
}: ModulFormHeaderProps) {
  const [searchSiswa, setSearchSiswa] = React.useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran gambar maksimal 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setIkon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Judul Modul <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={judulModul}
              onChange={(e) => setJudulModul(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Contoh: Pengenalan React JS"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mata Pelajaran <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={mataPelajaran}
              onChange={(e) => setMataPelajaran(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Contoh: Pemrograman Web"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prasyarat Modul (Opsional)
            </label>
            <select
              value={prasyaratId}
              onChange={(e) => setPrasyaratId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="">Tidak ada prasyarat</option>
              {existingModuls.map(m => (
                <option key={m.id} value={m.id}>{m.judul_modul}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Siswa harus menyelesaikan modul prasyarat sebelum dapat mengakses modul ini.</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Deskripsi Singkat
          </label>
          <textarea
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
            placeholder="Jelaskan secara singkat apa yang akan dipelajari dalam modul ini..."
          />
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Target Pembelajaran</h3>
        <div className="flex space-x-4 mb-4">
          <button
            type="button"
            onClick={() => setTipeTarget('KELAS')}
            className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center space-x-2 transition-colors ${
              tipeTarget === 'KELAS'
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Berdasarkan Kelas</span>
          </button>
          <button
            type="button"
            onClick={() => setTipeTarget('SISWA')}
            className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center space-x-2 transition-colors ${
              tipeTarget === 'SISWA'
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Siswa Spesifik</span>
          </button>
        </div>

        {tipeTarget === 'KELAS' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kelasList.map((kelas) => (
              <label
                key={kelas.id}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  targetKelasIds.includes(kelas.id)
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                    : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={targetKelasIds.includes(kelas.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTargetKelasIds([...targetKelasIds, kelas.id]);
                    } else {
                      setTargetKelasIds(targetKelasIds.filter(id => id !== kelas.id));
                    }
                  }}
                />
                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${
                  targetKelasIds.includes(kelas.id)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {targetKelasIds.includes(kelas.id) && <CheckCircle className="w-3.5 h-3.5" />}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{kelas.nama_kelas}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={searchSiswa}
              onChange={(e) => setSearchSiswa(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {siswaList
                .filter(s => s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase()))
                .map((siswa) => (
                <label
                  key={siswa.id}
                  className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={targetSiswaIds.includes(siswa.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTargetSiswaIds([...targetSiswaIds, siswa.id]);
                      } else {
                        setTargetSiswaIds(targetSiswaIds.filter(id => id !== siswa.id));
                      }
                    }}
                  />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${
                    targetSiswaIds.includes(siswa.id)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {targetSiswaIds.includes(siswa.id) && <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{siswa.nama_lengkap}</p>
                    <p className="text-xs text-gray-500">
                      {kelasList.find(k => k.id === siswa.kelas_id)?.nama_kelas || 'Tanpa Kelas'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
