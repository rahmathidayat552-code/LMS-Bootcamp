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
    console.log("Checking for redirect result...");
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log("Redirect result success for:", result.user.email);
      } else {
        console.log("No redirect result found.");
      }
    }).catch((error: any) => {
      console.error("Error getting redirect result:", error);
      if (error.code !== 'auth/redirect-cancelled-by-user') {
        toast.error('Gagal menyelesaikan login Google: ' + error.message);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      console.log("Firebase Auth State Changed. User:", firebaseUser ? firebaseUser.email : "null");
      
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          console.log("Fetching profile from Firestore for UID:", firebaseUser.uid);
          
          let userDoc = await getDoc(userDocRef);
          let retries = 0;
          
          while (!userDoc.exists() && retries < 3) {
            console.log(`Profile not found, retry ${retries + 1}/3...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            userDoc = await getDoc(userDocRef);
            retries++;
          }
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log("Profile successfully loaded:", data);
            setProfile({ uid: firebaseUser.uid, ...data } as UserProfile);
          } else {
            console.log("No profile found after retries. Checking admin status...");
            const adminEmail = 'rahmathidayat552@guru.smk.belajar.id'.toLowerCase().trim();
            const currentUserEmail = (firebaseUser.email || '').toLowerCase().trim();
            
            if (currentUserEmail === adminEmail) {
              console.log("Admin email matched! Creating new admin profile...");
              const newProfile = {
                email: firebaseUser.email || '',
                nama_lengkap: firebaseUser.displayName || 'Admin',
                role: 'ADMIN' as Role,
                created_at: new Date().toISOString()
              };
              try {
                await setDoc(userDocRef, newProfile);
                console.log("Admin profile created successfully in Firestore.");
                setProfile({ uid: firebaseUser.uid, ...newProfile } as UserProfile);
              } catch (setErr: any) {
                console.error("CRITICAL: Failed to create admin profile in Firestore:", setErr);
                toast.error("Gagal membuat profil admin: " + setErr.message);
                await signOut(auth);
              }
            } else {
              console.warn("User is not a registered student/teacher and not the default admin.");
              toast.error('Akun ini belum terdaftar di sistem.');
              await signOut(auth);
            }
          }
        } catch (error: any) {
          console.error("Error in AuthContext profile flow:", error);
          toast.error('Gagal memuat data profil: ' + error.message);
        }
      } else {
        console.log("No user session found.");
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
    
    // Detect if we are in a standalone PWA or on mobile
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    console.log("Initiating Google Login. PWA/Mobile:", { isStandalone, isMobile });

    try {
      // Use signInWithRedirect for PWA/Mobile for better stability
      if (isStandalone || isMobile) {
        console.log("Using signInWithRedirect");
        await signInWithRedirect(auth, provider);
      } else {
        // Use signInWithPopup for desktop browser for better reliability
        console.log("Using signInWithPopup");
        const { signInWithPopup } = await import('firebase/auth');
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('Popup login diblokir. Silakan izinkan popup atau gunakan mode PWA.');
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
