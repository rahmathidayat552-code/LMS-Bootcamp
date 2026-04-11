import React from 'react';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { KuisSoal } from './hooks/useModulForm';
import { toast } from 'sonner';

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

interface KuisSoalEditorProps {
  questions: KuisSoal[];
  updateQuestion: (qIndex: number, field: keyof KuisSoal, value: any) => void;
  removeQuestion: (qIndex: number) => void;
}

export default function KuisSoalEditor({ questions, updateQuestion, removeQuestion }: KuisSoalEditorProps) {
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
                  onChange={(content) => updateQuestion(qIndex, 'pertanyaan', content)}
                  modules={quizQuillModules}
                  formats={quizQuillFormats}
                  placeholder="Tulis pertanyaan di sini..."
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gambar Pendukung (Opsional)</label>
              {q.gambar ? (
                <div className="relative w-48 h-32 mb-2">
                  <img src={q.gambar} alt="Soal" className="w-full h-full object-contain bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700" />
                  <button
                    onClick={() => updateQuestion(qIndex, 'gambar', null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center">
                  <label className="flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                    <ImageIcon className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Upload Gambar</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleQuestionImageUpload(qIndex, e)} />
                  </label>
                  <span className="ml-3 text-xs text-gray-500">Maks 500KB</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['A', 'B', 'C', 'D'].map((opt) => (
                <div key={opt}>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Opsi {opt}</label>
                  <input
                    type="text"
                    value={(q as any)[`opsi_${opt.toLowerCase()}`]}
                    onChange={(e) => updateQuestion(qIndex, `opsi_${opt.toLowerCase()}` as keyof KuisSoal, e.target.value)}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-1 focus:ring-blue-500"
                    placeholder={`Jawaban ${opt}`}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-6 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kunci Jawaban</label>
                <select
                  value={q.kunci_jawaban}
                  onChange={(e) => updateQuestion(qIndex, 'kunci_jawaban', e.target.value)}
                  className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-1 focus:ring-blue-500"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bobot Nilai</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={q.bobot_nilai}
                  onChange={(e) => updateQuestion(qIndex, 'bobot_nilai', Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
