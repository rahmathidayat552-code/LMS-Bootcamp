import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Users, CheckCircle, Search, X, ChevronDown } from 'lucide-react';
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
  const [searchSiswa, setSearchSiswa] = useState('');
  const [searchKelas, setSearchKelas] = useState('');
  const [isKelasDropdownOpen, setIsKelasDropdownOpen] = useState(false);
  const [isSiswaDropdownOpen, setIsSiswaDropdownOpen] = useState(false);
  
  const kelasDropdownRef = useRef<HTMLDivElement>(null);
  const siswaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (kelasDropdownRef.current && !kelasDropdownRef.current.contains(event.target as Node)) {
        setIsKelasDropdownOpen(false);
      }
      if (siswaDropdownRef.current && !siswaDropdownRef.current.contains(event.target as Node)) {
        setIsSiswaDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const filteredKelas = kelasList.filter(k => k.nama_kelas.toLowerCase().includes(searchKelas.toLowerCase()));
  const filteredSiswa = siswaList.filter(s => s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase()));

  const toggleKelas = (id: string) => {
    if (targetKelasIds.includes(id)) {
      setTargetKelasIds(targetKelasIds.filter(kId => kId !== id));
    } else {
      setTargetKelasIds([...targetKelasIds, id]);
    }
  };

  const toggleSiswa = (id: string) => {
    if (targetSiswaIds.includes(id)) {
      setTargetSiswaIds(targetSiswaIds.filter(sId => sId !== id));
    } else {
      setTargetSiswaIds([...targetSiswaIds, id]);
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
          <div className="relative" ref={kelasDropdownRef}>
            <div 
              className="w-full min-h-[42px] px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer flex items-center justify-between"
              onClick={() => setIsKelasDropdownOpen(!isKelasDropdownOpen)}
            >
              <div className="flex flex-wrap gap-2 flex-1">
                {targetKelasIds.length === 0 ? (
                  <span className="text-gray-500 dark:text-gray-400">Pilih Kelas...</span>
                ) : (
                  targetKelasIds.map(id => {
                    const k = kelasList.find(cls => cls.id === id);
                    return k ? (
                      <span key={id} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        {k.nama_kelas}
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); toggleKelas(id); }}
                          className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>

            {isKelasDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Cari kelas..."
                      value={searchKelas}
                      onChange={(e) => setSearchKelas(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {filteredKelas.length === 0 ? (
                    <div className="p-3 text-center text-sm text-gray-500">Kelas tidak ditemukan</div>
                  ) : (
                    filteredKelas.map(kelas => (
                      <div
                        key={kelas.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md cursor-pointer"
                        onClick={() => toggleKelas(kelas.id)}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 flex-shrink-0 ${
                          targetKelasIds.includes(kelas.id)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {targetKelasIds.includes(kelas.id) && <CheckCircle className="w-3 h-3" />}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{kelas.nama_kelas}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative" ref={siswaDropdownRef}>
            <div 
              className="w-full min-h-[42px] px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer flex items-center justify-between"
              onClick={() => setIsSiswaDropdownOpen(!isSiswaDropdownOpen)}
            >
              <div className="flex flex-wrap gap-2 flex-1">
                {targetSiswaIds.length === 0 ? (
                  <span className="text-gray-500 dark:text-gray-400">Pilih Siswa...</span>
                ) : (
                  targetSiswaIds.map(id => {
                    const s = siswaList.find(siswa => siswa.id === id);
                    return s ? (
                      <span key={id} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        {s.nama_lengkap}
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); toggleSiswa(id); }}
                          className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>

            {isSiswaDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Cari siswa..."
                      value={searchSiswa}
                      onChange={(e) => setSearchSiswa(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {filteredSiswa.length === 0 ? (
                    <div className="p-3 text-center text-sm text-gray-500">Siswa tidak ditemukan</div>
                  ) : (
                    filteredSiswa.map(siswa => (
                      <div
                        key={siswa.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md cursor-pointer"
                        onClick={() => toggleSiswa(siswa.id)}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 flex-shrink-0 ${
                          targetSiswaIds.includes(siswa.id)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {targetSiswaIds.includes(siswa.id) && <CheckCircle className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{siswa.nama_lengkap}</p>
                          <p className="text-xs text-gray-500">
                            {kelasList.find(k => k.id === siswa.kelas_id)?.nama_kelas || 'Tanpa Kelas'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
