import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export type Role = 'ADMIN' | 'GURU' | 'SISWA';

export interface UserProfile {
  uid: string;
  email: string;
  nama_lengkap: string;
  role: Role;
  kelas_id?: string;
  username?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ensure persistence is set
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setProfile({ uid: firebaseUser.uid, ...userDoc.data() } as UserProfile);
          } else {
            // Check if there's a pre-registered user with this email
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email?.toLowerCase()));
            const querySnapshot = await getDocs(q);
            
            let newProfile: Omit<UserProfile, 'uid'>;
            
            if (!querySnapshot.empty) {
              // Use pre-registered data
              const preRegData = querySnapshot.docs[0].data();
              newProfile = {
                email: firebaseUser.email || '',
                nama_lengkap: preRegData.nama_lengkap || firebaseUser.displayName || 'User',
                role: preRegData.role || 'SISWA',
                username: preRegData.username || '',
                kelas_id: preRegData.kelas_id || '',
                created_at: preRegData.created_at || new Date().toISOString()
              };
            } else {
              // Check if this is the default admin
              const isDefaultAdmin = firebaseUser.email === 'rahmathidayat552@guru.smk.belajar.id';
              newProfile = {
                email: firebaseUser.email || '',
                nama_lengkap: firebaseUser.displayName || 'User',
                role: isDefaultAdmin ? 'ADMIN' : 'SISWA', // Default to SISWA if not admin
                created_at: new Date().toISOString()
              };
            }
            
            await setDoc(userDocRef, newProfile);
            setProfile({ uid: firebaseUser.uid, ...newProfile } as UserProfile);
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

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, logout }}>
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
