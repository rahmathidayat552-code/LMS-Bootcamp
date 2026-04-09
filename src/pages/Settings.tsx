import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { toast } from 'sonner';
import { KeyRound, Monitor, Moon, Sun, Palette, Image as ImageIcon, Upload, Loader2, X } from 'lucide-react';

export default function Settings() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings } = useSettings();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Harap unggah file gambar yang valid');
      return;
    }

    // Validate file size (max 1MB for Base64 storage)
    if (file.size > 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 1MB');
      return;
    }

    try {
      setUploadingLogo(true);
      
      // Convert to Base64 instead of uploading to Firebase Storage
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          
          await setDoc(doc(db, 'settings', 'app_config'), {
            logoUrl: base64String
          }, { merge: true });

          toast.success('Logo aplikasi berhasil diperbarui');
        } catch (error: any) {
          console.error('Error saving logo to Firestore:', error);
          toast.error('Gagal menyimpan logo: ' + error.message);
        } finally {
          setUploadingLogo(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      
      reader.onerror = () => {
        toast.error('Gagal membaca file gambar');
        setUploadingLogo(false);
      };
      
      reader.readAsDataURL(file);
      
    } catch (error: any) {
      console.error('Error processing logo:', error);
      toast.error('Gagal memproses logo: ' + error.message);
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus logo kustom dan kembali ke logo default?')) {
      return;
    }

    try {
      setUploadingLogo(true);
      await setDoc(doc(db, 'settings', 'app_config'), {
        logoUrl: null
      }, { merge: true });
      toast.success('Logo berhasil dihapus');
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast.error('Gagal menghapus logo: ' + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola preferensi akun dan tampilan aplikasi Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* App Settings (Admin Only) */}
        {profile?.role === 'ADMIN' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden md:col-span-2">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
              <ImageIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pengaturan Aplikasi</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 overflow-hidden relative group">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="App Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="p-2 bg-white rounded-full text-gray-900 hover:bg-gray-100 transition-colors"
                        title="Ubah Logo"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Logo Aplikasi</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Unggah logo kustom untuk ditampilkan di halaman login dan sidebar. Format yang didukung: PNG, JPG, SVG (Maks. 1MB).
                  </p>
                  
                  <div className="flex items-center space-x-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {uploadingLogo ? 'Mengunggah...' : 'Unggah Logo'}
                    </button>
                    
                    {settings.logoUrl && (
                      <button
                        onClick={handleRemoveLogo}
                        disabled={uploadingLogo}
                        className="flex items-center px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Metode Autentikasi</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Login Email & Password</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Izinkan pengguna login menggunakan email dan password.</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'settings', 'app_config'), {
                          enableEmailLogin: !settings.enableEmailLogin
                        }, { merge: true });
                        toast.success(`Login Email & Password ${!settings.enableEmailLogin ? 'diaktifkan' : 'dinonaktifkan'}`);
                      } catch (error: any) {
                        toast.error('Gagal mengubah pengaturan: ' + error.message);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                      settings.enableEmailLogin ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.enableEmailLogin ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
