import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { updatePassword } from 'firebase/auth';
import { auth } from '../firebase';
import { toast } from 'sonner';
import { KeyRound, Monitor, Moon, Sun, Palette } from 'lucide-react';

export default function Settings() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user logged in with email/password
  const isEmailAuth = user?.providerData.some(provider => provider.providerId === 'password');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Harap isi semua kolom password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Password baru dan konfirmasi tidak cocok');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    try {
      setLoading(true);
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        toast.success('Password berhasil diubah');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Sesi Anda telah berakhir. Silakan logout dan login kembali untuk mengubah password.');
      } else {
        toast.error('Gagal mengubah password: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola preferensi akun dan tampilan aplikasi Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
            <Palette className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tampilan</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Pilih tema warna untuk aplikasi.</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  theme === 'light' 
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <Sun className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Terang</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  theme === 'dark' 
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <Moon className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Gelap</span>
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  theme === 'system' 
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <Monitor className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Sistem</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
            <KeyRound className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keamanan</h2>
          </div>
          <div className="p-6">
            {!isEmailAuth ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg text-sm">
                Anda login menggunakan Google. Pengaturan password dikelola langsung melalui akun Google Anda.
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    placeholder="Ulangi password baru"
                    minLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Menyimpan...' : 'Ubah Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
