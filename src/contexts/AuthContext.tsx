import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser, 
  setPersistence, 
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export type Role = 'ADMIN' | 'GURU' | 'SISWA';

export interface UserProfile {
  uid: string;
  email: string;
  nama_lengkap: string;
  role: Role;
  kelas_id?: string;
  username?: string;
  no_wa?: string;
  foto_url?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile({ uid: user.uid, ...docSnap.data() } as UserProfile);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  };

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
    console.log("AuthContext initialized. Current URL:", window.location.href);
    console.log("Is Iframe:", window.self !== window.top);

    // Handle redirect result for Google Login
    const redirectPromise = getRedirectResult(auth).catch((error: any) => {
      console.error("Error getting redirect result:", error);
      if (error.code !== 'auth/redirect-cancelled-by-user') {
        toast.error('Gagal menyelesaikan login Google: ' + error.message);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          
          let userDoc = await getDoc(userDocRef);
          let retries = 0;
          
          while (!userDoc.exists() && retries < 3) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            userDoc = await getDoc(userDocRef);
            retries++;
          }
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({ uid: firebaseUser.uid, ...data } as UserProfile);
          } else {
            const adminEmail = 'rahmathidayat552@guru.smk.belajar.id'.toLowerCase().trim();
            const currentUserEmail = (firebaseUser.email || '').toLowerCase().trim();
            
            if (currentUserEmail === adminEmail) {
              const newProfile = {
                email: firebaseUser.email || '',
                nama_lengkap: firebaseUser.displayName || 'Admin',
                role: 'ADMIN' as Role,
                created_at: new Date().toISOString()
              };
              try {
                await setDoc(userDocRef, newProfile);
                setProfile({ uid: firebaseUser.uid, ...newProfile } as UserProfile);
              } catch (setErr: any) {
                console.error("CRITICAL: Failed to create admin profile in Firestore:", setErr);
                toast.error("Gagal membuat profil admin: " + setErr.message);
                await signOut(auth).catch(e => console.error("Sign out failed", e));
              }
            } else {
              toast.error('Akun ini belum terdaftar di sistem.');
              await signOut(auth).catch(e => console.error("Sign out failed", e));
            }
          }
        } catch (error: any) {
          console.error("Error in AuthContext profile flow:", error);
          toast.error('Gagal memuat data profil: ' + error.message);
        }
      } else {
        // Wait for redirect to finish before assuming user is not logged in
        await redirectPromise;
        if (auth.currentUser) {
          // If user is now logged in, onAuthStateChanged will fire again
          return;
        }
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // iOS standalone PWA has severe issues with popups, always use redirect
    const forceRedirect = isIOS && isStandalone;

    try {
      if (forceRedirect) {
        console.log("iOS Standalone detected, using signInWithRedirect");
        await signInWithRedirect(auth, provider);
      } else {
        console.log("Attempting signInWithPopup");
        const { signInWithPopup } = await import('firebase/auth');
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      if (error.code === 'auth/popup-blocked') {
        console.log("Popup blocked, falling back to redirect...");
        toast.info('Popup diblokir, mengalihkan halaman...');
        await signInWithRedirect(auth, provider);
      } else {
        throw error;
      }
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, loginWithEmail, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
