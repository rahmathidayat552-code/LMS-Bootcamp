import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          
          // Retry logic for fetching user profile (handles registration race condition)
          let userDoc = await getDoc(userDocRef);
          let retries = 0;
          
          while (!userDoc.exists() && retries < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            userDoc = await getDoc(userDocRef);
            retries++;
          }
          
          if (userDoc.exists()) {
            setProfile({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
          } else {
            // Check if this is the default admin logging in with Google
            const isDefaultAdmin = firebaseUser.email === 'rahmathidayat552@guru.smk.belajar.id';
            if (isDefaultAdmin) {
              const newProfile = {
                email: firebaseUser.email || '',
                nama_lengkap: firebaseUser.displayName || 'Admin',
                role: 'ADMIN' as Role,
                created_at: new Date().toISOString()
              };
              await setDoc(userDocRef, newProfile);
              setProfile({ uid: firebaseUser.uid, ...newProfile } as UserProfile);
            } else {
              // If not admin and no profile exists after retries, they must register first
              // We will sign them out if they try to bypass registration with Google
              await signOut(auth);
              setProfile(null);
              setUser(null);
              console.error('Silakan registrasi terlebih dahulu menggunakan NISN/NIP.');
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
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
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
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
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, loginWithEmail, logout }}>
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
