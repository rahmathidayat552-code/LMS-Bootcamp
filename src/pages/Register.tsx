import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { BookOpen, UserPlus, Mail, Lock, Calendar, Hash, User } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      // 1. Verify against master_users
      const masterDocRef = doc(db, 'master_users', formData.username);
      const masterDoc = await getDoc(masterDocRef);

      if (!masterDoc.exists()) {
        toast.error('Data tidak ditemukan! Pastikan NISN/NIP sesuai dengan data sekolah.');
        setLoading(false);
        return;
      }

      const masterData = masterDoc.data();

      if (masterData.tanggal_lahir !== formData.tanggal_lahir || masterData.role !== formData.role) {
        toast.error('Tanggal Lahir atau Role tidak sesuai dengan data sekolah.');
        setLoading(false);
        return;
      }

      if (masterData.is_registered) {
        toast.error('Akun ini sudah terdaftar! Silakan login menggunakan email Anda.');
        setLoading(false);
        return;
      }

      // 2. Create Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const firebaseUser = userCredential.user;

      // 3. Create User Profile in 'users' collection
      const userProfileData = {
        email: formData.email.toLowerCase(),
        nama_lengkap: masterData.nama_lengkap,
        role: masterData.role,
        username: masterData.username,
        kelas_id: masterData.kelas_id || '',
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userProfileData);

      // 4. Mark master_users as registered
      await updateDoc(doc(db, 'master_users', masterDoc.id), {
        is_registered: true
      });

      toast.success('Registrasi berhasil! Silakan login.');
      navigate('/login');

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
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Registrasi Akun
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Verifikasi data Anda untuk membuat akun LMS
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
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

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
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

          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <UserPlus className="h-5 w-5 text-blue-500 group-hover:text-blue-400" aria-hidden="true" />
              </span>
              {loading ? 'Memproses...' : 'Daftar Akun'}
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
