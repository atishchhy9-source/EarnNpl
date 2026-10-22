import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, BOOTSTRAP_ADMIN_EMAIL } from '../firebase/config';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (name: string, e: string, p: string) => Promise<void>;
  sendPasswordReset: (e: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync with Firestore profile and listen to changes
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!user) {
        setUserProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const isEmailAdmin = (user.email || '').trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      setIsAdmin(isEmailAdmin);

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data() as UserProfile;
          setUserProfile(data);

          let hasAdminDoc = false;
          try {
            const adminDocSnap = await getDoc(doc(db, 'admins', user.uid));
            hasAdminDoc = adminDocSnap.exists();
          } catch {
            // Non-blocking
          }

          setIsAdmin(isEmailAdmin || hasAdminDoc || data.role === 'admin');

          // If email is runtime admin, ensure admin doc exists
          if (isEmailAdmin && !hasAdminDoc) {
            try {
              await setDoc(doc(db, 'admins', user.uid), {
                id: user.uid,
                email: user.email,
                role: 'admin',
                createdAt: new Date().toISOString(),
              }, { merge: true });
            } catch (e) {
              console.warn('Could not bootstrap admin doc:', e);
            }
          }
        } else {
          // Create initial user profile
          const randomCode = 'NPL-' + Math.floor(100000 + Math.random() * 900000);
          const initialProfile: UserProfile = {
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Nepali Earner',
            email: user.email || '',
            userCode: randomCode,
            balance: 0,
            pendingDeposits: 0,
            pendingWithdrawals: 0,
            totalDeposited: 0,
            totalWithdrawn: 0,
            role: isEmailAdmin ? 'admin' : 'user',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          try {
            await setDoc(userDocRef, initialProfile);
          } catch (createErr) {
            console.warn('Initial profile create error:', createErr);
          }

          setUserProfile(initialProfile);
          setIsAdmin(isEmailAdmin);

          if (isEmailAdmin) {
            try {
              await setDoc(doc(db, 'admins', user.uid), {
                id: user.uid,
                email: user.email,
                role: 'admin',
                createdAt: new Date().toISOString(),
              }, { merge: true });
            } catch (e) {
              console.warn('Admin record write note:', e);
            }
          }
        }

        // Attach real-time snapshot listener for live balance & status updates
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const freshData = docSnap.data() as UserProfile;
            setUserProfile(freshData);
            setIsAdmin(isEmailAdmin || freshData.role === 'admin');
          }
        }, (error) => {
          console.warn('Profile snapshot listener notice:', error.message);
        });

      } catch (err) {
        console.error('Error during user auth profile init:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google sign-in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      console.error('Email sign-in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (name: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (cred.user) {
        await updateProfile(cred.user, { displayName: name });
        const isEmailAdmin = email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        const randomCode = 'NPL-' + Math.floor(100000 + Math.random() * 900000);

        const newProfile: UserProfile = {
          id: cred.user.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          userCode: randomCode,
          balance: 0,
          pendingDeposits: 0,
          pendingWithdrawals: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          role: isEmailAdmin ? 'admin' : 'user',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await setDoc(doc(db, 'users', cred.user.uid), newProfile);
        } catch (setErr) {
          console.warn('Profile write error during signup:', setErr);
        }

        setUserProfile(newProfile);
        setIsAdmin(isEmailAdmin);
      }
    } catch (err) {
      console.error('Email registration error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setIsAdmin(false);
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
