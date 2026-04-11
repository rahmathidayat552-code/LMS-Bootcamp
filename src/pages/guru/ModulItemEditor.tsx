import React from 'react';
import { Youtube, ExternalLink, Plus } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ModulItem, KuisSoal } from './hooks/useModulForm';
import KuisSoalEditor from './KuisSoalEditor';

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

interface ModulItemEditorProps {
  item: ModulItem;
  index: number;
  handleItemChange: (index: number, field: keyof ModulItem, value: any) => void;
}

export default function ModulItemEditor({ item, index, handleItemChange }: ModulItemEditorProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
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
          <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
            <ReactQuill
              theme="snow"
              value={item.deskripsi || ''}
              onChange={(content) => handleItemChange(index, 'deskripsi', content)}
              modules={quizQuillModules}
              formats={quizQuillFormats}
              placeholder="Berikan instruksi apa yang harus dilakukan siswa pada tahap ini..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        {/* Feedback & Pertanyaan Settings */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Wajibkan Feedback</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Siswa harus mengisi feedback setelah menyelesaikan tahap ini</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={item.wajib_feedback !== false} // Default true
                onChange={(e) => handleItemChange(index, 'wajib_feedback', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="pt-2 border-t border-blue-100 dark:border-blue-800/50">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pertanyaan Khusus (Opsional)</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tambahkan pertanyaan yang wajib dijawab siswa pada tahap ini.</p>
            <input
              type="text"
              value={item.pertanyaan_feedback || ''}
              onChange={(e) => handleItemChange(index, 'pertanyaan_feedback', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Contoh: Apa kesimpulan Anda dari materi ini?"
            />
          </div>
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
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <Youtube className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Cari Video Manual</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Buka YouTube untuk mencari video yang sesuai</p>
                  </div>
                </div>
                <a
                  href="https://www.youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Buka YouTube
                </a>
              </div>
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

              return (
                <div className="space-y-6">
                  <KuisSoalEditor 
                    questions={questions}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                  />
                  <button
                    onClick={addQuestion}
                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors flex items-center justify-center font-medium"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Tambah Soal
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {item.tipe_item === 'TUGAS' && (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 mb-4">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Atur jenis pengumpulan tugas yang diizinkan untuk siswa.
              </p>
            </div>

            {(() => {
              let config = { allow_link: true, allow_file: false, allowed_extensions: [] };
              try {
                if (item.konten) {
                  config = JSON.parse(item.konten);
                }
              } catch (e) {
                // use default
              }

              const updateConfig = (field: string, value: any) => {
                const newConfig = { ...config, [field]: value };
                handleItemChange(index, 'konten', JSON.stringify(newConfig));
              };

              return (
                <div className="space-y-4">
                  <label className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.allow_link}
                      onChange={(e) => updateConfig('allow_link', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">Izinkan Pengumpulan Link</span>
                      <span className="block text-xs text-gray-500">Siswa dapat mengumpulkan link Google Drive, Github, dll.</span>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.allow_file}
                      onChange={(e) => updateConfig('allow_file', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">Izinkan Upload File (Segera Hadir)</span>
                      <span className="block text-xs text-gray-500">Fitur upload file langsung ke sistem sedang dalam pengembangan.</span>
                    </div>
                  </label>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
