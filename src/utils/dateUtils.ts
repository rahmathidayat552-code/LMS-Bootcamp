/**
 * Utility for date formatting with Asia/Makassar timezone (WITA)
 */

export const formatDateTime = (date: Date | string | any, options: Intl.DateTimeFormatOptions = {}) => {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : (date.toDate ? date.toDate() : new Date(date));
  
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar',
    ...options
  });
};

export const formatDate = (date: Date | string | any, options: Intl.DateTimeFormatOptions = {}) => {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : (date.toDate ? date.toDate() : new Date(date));
  
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Makassar',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options
  });
};

export const formatTime = (date: Date | string | any, options: Intl.DateTimeFormatOptions = {}) => {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : (date.toDate ? date.toDate() : new Date(date));
  
  return d.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
};

export const formatFullDate = (date: Date | string | any) => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : (date.toDate ? date.toDate() : new Date(date));
  
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
