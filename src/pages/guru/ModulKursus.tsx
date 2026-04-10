import React from 'react';
import { BookOpen, Clock } from 'lucide-react';

export default function ModulKursus() {
  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-12 h-12 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Modul Kursus</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
          Fitur Modul Kursus sedang dalam tahap pengembangan. Nantinya, Anda dapat membuat dan mengelola kursus interaktif dengan berbagai materi, kuis, dan sertifikat.
        </p>
        <div className="inline-flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full font-medium">
          <Clock className="w-5 h-5 mr-2" />
          Segera Hadir (Coming Soon)
        </div>
      </div>
    </div>
  );
}
