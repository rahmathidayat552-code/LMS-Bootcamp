import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notif: any) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Bell className="w-6 h-6 mr-2" /> Notifikasi
        </h1>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={markAllAsRead}
            className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors"
          >
            <Check className="w-4 h-4 mr-1" /> Tandai semua dibaca
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Belum ada notifikasi.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer flex items-start gap-4 ${
                  !notif.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${!notif.is_read ? 'bg-blue-600' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm font-semibold ${!notif.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {notif.created_at ? formatDistanceToNow(notif.created_at.toDate(), { addSuffix: true, locale: id }) : 'Baru saja'}
                    </span>
                  </div>
                  <p className={`text-sm ${!notif.is_read ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
                    {notif.message}
                  </p>
                  {notif.link && (
                    <div className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center">
                      Lihat detail <ExternalLink className="w-3 h-3 ml-1" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
