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

    // Handle redirect result for Google Login
    getRedirectResult(auth).catch((error: any) => {
      console.error("Error getting redirect result:", error);
      if (error.code !== 'auth/redirect-cancelled-by-user') {
        toast.error('Gagal menyelesaikan login Google: ' + error.message);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          console.log("User authenticated, fetching profile for:", firebaseUser.email);
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          
          // Retry logic for fetching user profile (handles registration race condition)
          let userDoc = await getDoc(userDocRef);
          let retries = 0;
          
          while (!userDoc.exists() && retries < 3) {
            console.log(`Profile not found, retry ${retries + 1}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            userDoc = await getDoc(userDocRef);
            retries++;
          }
          
          if (userDoc.exists()) {
            console.log("Profile found:", userDoc.data());
            setProfile({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
          } else {
            console.log("Profile not found after retries. Checking if default admin...");
            // Check if this is the default admin logging in with Google (Case-insensitive check)
            const adminEmail = 'rahmathidayat552@guru.smk.belajar.id'.toLowerCase().trim();
            const currentUserEmail = (firebaseUser.email || '').toLowerCase().trim();
            
            const isDefaultAdmin = currentUserEmail === adminEmail;
            
            if (isDefaultAdmin) {
              console.log("Default admin detected, creating profile...");
              const newProfile = {
                email: firebaseUser.email || '',
                nama_lengkap: firebaseUser.displayName || 'Admin',
                role: 'ADMIN' as Role,
                created_at: new Date().toISOString()
              };
              await setDoc(userDocRef, newProfile);
              console.log("Admin profile created successfully");
              setProfile({ uid: firebaseUser.uid, ...newProfile } as UserProfile);
            } else {
              console.warn("User not registered and not default admin. Signing out.");
              toast.error('Akun Google ini belum terdaftar. Silakan registrasi terlebih dahulu.');
              await signOut(auth);
              setProfile(null);
              setUser(null);
            }
          }
        } catch (error: any) {
          console.error("Error fetching user profile:", error);
          toast.error('Gagal memuat profil: ' + (error.message || 'Error tidak diketahui'));
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Use custom parameters to ensure a better experience on mobile
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error("Error signing in with Google redirect:", error);
      throw error;
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
