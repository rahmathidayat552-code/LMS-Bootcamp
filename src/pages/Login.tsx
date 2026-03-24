import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, LogIn } from 'lucide-react';

export default function Login() {
  const { loginWithGoogle, user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || '/';

  // Redirect if already logged in
  React.useEffect(() => {
    if (user && profile) {
      navigate(from, { replace: true });
    }
  }, [user, profile, navigate, from]);

  const handleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      // The redirect will happen automatically due to the useEffect above
    } catch (err: any) {
      setError(err.message || 'Gagal masuk dengan Google');
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
            LMS SMKN 9 Bulukumba
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sistem Manajemen Pembelajaran Terstruktur
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md text-sm text-center">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          <button
            onClick={handleLogin}
            disabled={loading}
            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <LogIn className="h-5 w-5 text-blue-500 group-hover:text-blue-400" aria-hidden="true" />
            </span>
            {loading ? 'Memproses...' : 'Masuk dengan Google'}
          </button>
        </div>
        
        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>Gunakan akun Google yang terdaftar di sekolah.</p>
        </div>
      </div>
    </div>
  );
}
