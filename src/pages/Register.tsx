import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useSettings } from '../contexts/SettingsContext';
import { BookOpen, UserPlus, Mail, Lock, Calendar, Hash, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [masterData, setMasterData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    role: 'SISWA',
    username: '', // NISN or NIP
    tanggal_lahir: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const masterDocRef = doc(db, 'master_users', formData.username);
      const masterDoc = await getDoc(masterDocRef);

      if (!masterDoc.exists()) {
        toast.error(`${formData.role === 'SISWA' ? 'NISN' : 'NIP'} belum terdaftar oleh admin silahkan hubungi admin LMS`);
        setLoading(false);
        return;
      }

      const data = masterDoc.data();

      if (data.tanggal_lahir !== formData.tanggal_lahir || data.role !== formData.role) {
        toast.error('Tanggal Lahir atau Role tidak sesuai dengan data sekolah.');
        setLoading(false);
        return;
      }

      if (data.is_registered) {
        toast.error('Akun ini sudah terdaftar! Silakan login menggunakan email Anda.');
        setLoading(false);
        return;
      }

      setMasterData(data);
      setStep(2);
      toast.success('Data ditemukan! Silakan lengkapi email dan password.');
    } catch (error) {
      console.error("Verification error:", error);
      toast.error('Terjadi kesalahan saat memverifikasi data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Password dan Konfirmasi Password tidak cocok!');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password minimal 6 karakter!');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const firebaseUser = userCredential.user;

      try {
        // 2. Create User Profile in 'users' collection
        const userProfileData = {
          email: formData.email.toLowerCase(),
          nama_lengkap: masterData.nama_lengkap,
          role: masterData.role,
          username: masterData.username,
          kelas_id: masterData.kelas_id || '',
          created_at: new Date().toISOString() // ISO string for DB
        };

        await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);

        // 3. Mark master_users as registered
        await updateDoc(doc(db, 'master_users', formData.username), {
          is_registered: true
        });

        toast.success('Berhasil registrasi pengguna!');
        navigate('/login');
      } catch (firestoreError: any) {
        // Rollback Firebase Auth user if Firestore fails
        await firebaseUser.delete().catch(e => console.error("Rollback failed", e));
        throw firestoreError;
      }

    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email ini sudah digunakan oleh akun lain.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Format email tidak valid.');
      } else {
        toast.error('Terjadi kesalahan saat registrasi. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-10 rounded-xl shadow-2xl">
        <div>
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center overflow-hidden">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="LMS Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Registrasi Akun
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {step === 1 ? 'Langkah 1: Verifikasi Data' : 'Langkah 2: Buat Kredensial'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={step === 1 ? handleVerify : handleRegister}>
          <div className="space-y-4">
            
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Daftar Sebagai
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="SISWA">Siswa</option>
                      <option value="GURU">Guru</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.role === 'SISWA' ? 'NISN' : 'NIP'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="username"
                      required
                      value={formData.username}
                      onChange={handleChange}
                      className="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder={`Masukkan ${formData.role === 'SISWA' ? 'NISN' : 'NIP'} Anda`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal Lahir
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      name="tanggal_lahir"
                      required
                      value={formData.tanggal_lahir}
                      onChange={handleChange}
                      className="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-semibold">Nama:</span> {masterData?.nama_lengkap}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-semibold">{formData.role === 'SISWA' ? 'NISN' : 'NIP'}:</span> {masterData?.username}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Baru
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Alamat Email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Minimal 6 karakter"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="appearance-none rounded-lg relative block w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Ulangi password"
                    />
                  </div>
                </div>
              </>
            )}

          </div>

          <div className="flex space-x-3">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <span className="flex items-center justify-center">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </span>
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`flex-[2] group relative flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {step === 1 ? (
                <>
                  {loading ? 'Memverifikasi...' : 'Lanjut'}
                  {!loading && <ArrowRight className="absolute right-4 h-5 w-5 text-blue-200 group-hover:text-white" />}
                </>
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <UserPlus className="h-5 w-5 text-blue-500 group-hover:text-blue-400" aria-hidden="true" />
                  </span>
                  {loading ? 'Memproses...' : 'Daftar Akun'}
                </>
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Sudah punya akun?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
