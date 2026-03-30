import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BookOpen, Users, Settings, LogOut, Menu, X, Moon, Sun, Monitor, LayoutDashboard, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Layout() {
  const { profile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    toast.success('Berhasil logout!');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'GURU', 'SISWA'] },
    { name: 'Manajemen Kelas', path: '/admin/kelas', icon: BookOpen, roles: ['ADMIN'] },
    { name: 'Manajemen Guru', path: '/admin/guru', icon: Users, roles: ['ADMIN'] },
    { name: 'Manajemen Siswa', path: '/admin/siswa', icon: Users, roles: ['ADMIN'] },
    { name: 'Manajemen Pengguna', path: '/admin/users', icon: Users, roles: ['ADMIN'] },
    { name: 'Modul Belajar', path: '/guru/modul', icon: BookOpen, roles: ['GURU'] },
    { name: 'Penilaian', path: '/guru/penilaian', icon: FileCheck, roles: ['GURU'] },
    { name: 'Modul Belajar', path: '/siswa/modul', icon: BookOpen, roles: ['SISWA'] },
    { name: 'Edit Profil', path: '/profil', icon: Users, roles: ['ADMIN', 'GURU', 'SISWA'] },
    { name: 'Pengaturan', path: '/pengaturan', icon: Settings, roles: ['ADMIN', 'GURU', 'SISWA'] },
  ];

  const filteredNavItems = navItems.filter(item => profile && item.roles.includes(profile.role));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-xl">LMS SMKN 9</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
              {profile?.foto_url ? (
                <img 
                  src={profile.foto_url} 
                  alt={profile.nama_lengkap} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                profile?.nama_lengkap?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">{profile?.nama_lengkap}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{profile?.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false) }}
                    className={`
                      flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'}
                    `}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                    <span className="font-medium truncate">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
        {/* Top Header */}
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
              <Menu className="w-6 h-6" />
            </button>
            {!isSidebarOpen && (
              <div className="flex items-center space-x-2">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-lg hidden sm:block">LMS SMKN 9</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              {theme === 'system' ? <Monitor className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet context={{ isSidebarOpen }} />
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <LogOut className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">
                Konfirmasi Keluar
              </h3>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                Apakah Anda yakin ingin keluar dari aplikasi?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Ya, Keluar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
