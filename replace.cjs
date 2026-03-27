const fs = require('fs');
const content = fs.readFileSync('src/pages/guru/ModulForm.tsx', 'utf8');

const startStr = `      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tahapan Belajar</h2>
        
        {items.map((item, index) => (
          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">`;

const endStr = `            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-3 pt-2">`;

const replacement = `      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tahapan Belajar</h2>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {items.length > 0 ? \`Tahap \${currentStepIndex + 1} dari \${items.length}\` : 'Belum ada tahapan'}
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
                    <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">`;

const replacementEnd = `                    </div>
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

        <div className="flex flex-wrap gap-3 pt-2">`;

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end string");
  process.exit(1);
}

const middleContent = content.substring(startIndex + startStr.length, endIndex);
const newMiddleContent = middleContent.split('\n').map(line => '  ' + line).join('\n');

const newContent = content.substring(0, startIndex) + replacement + newMiddleContent + replacementEnd + content.substring(endIndex + endStr.length);

fs.writeFileSync('src/pages/guru/ModulForm.tsx', newContent);
console.log("Replaced successfully");
