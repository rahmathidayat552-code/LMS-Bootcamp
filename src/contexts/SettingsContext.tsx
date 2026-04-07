import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface AppSettings {
  logoUrl: string | null;
  enableEmailLogin: boolean;
}

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: { logoUrl: null, enableEmailLogin: true },
  loading: true,
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>({ logoUrl: null, enableEmailLogin: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'app_config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          logoUrl: data.logoUrl || null,
          enableEmailLogin: data.enableEmailLogin !== false, // default to true if undefined
        });
      } else {
        setSettings({ logoUrl: null, enableEmailLogin: true });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching app settings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};
