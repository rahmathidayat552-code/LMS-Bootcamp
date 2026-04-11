import React from 'react';
import { Users, Construction } from 'lucide-react';
import { motion } from 'motion/react';

export default function ModulKolaborasi() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Modul Kolaborasi</h1>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 flex flex-col items-center justify-center text-center min-h-[400px]"
      >
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
          <Users className="w-10 h-10 text-blue-500 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Fitur Sedang Dikembangkan
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
          Modul Kolaborasi akan memungkinkan Anda untuk berbagi dan berkolaborasi dalam membuat materi pembelajaran dengan guru-guru lainnya. Fitur ini akan segera hadir!
        </p>
        <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full">
          <Construction className="w-4 h-4 mr-2" />
          Coming Soon
        </div>
      </motion.div>
    </div>
  );
}
