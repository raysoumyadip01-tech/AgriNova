import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider, syncUserProfileToFirestore } from '../lib/firebase';
import { api, getStoredToken, setStoredToken } from '../services/api';
import type { FarmerLanguage, PublicRegisterRole, ThemeMode, User, UserRole } from '../types/auth';
import { useTheme } from './ThemeContext';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    role: PublicRegisterRole;
    location?: string;
    language_preference?: FarmerLanguage;
  }) => Promise<User>;
  demoLogin: (role: UserRole) => Promise<User>;
  firebaseGoogleLogin: (role?: PublicRegisterRole) => Promise<User>;
  googleDemoLogin: (payload: { email: string; full_name: string; role: PublicRegisterRole }) => Promise<User>;
  verifyOtpDemo: (payload: {
    phone: string;
    otp_code: string;
    role: PublicRegisterRole;
    full_name?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (payload: {
    full_name?: string;
    phone?: string;
    location?: string;
    theme_preference?: ThemeMode;
    language_preference?: FarmerLanguage;
  }) => Promise<User>;
  deleteAccount: (payload: { confirmation: 'DELETE'; password?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { setTheme } = useTheme();

  const applyAuthenticatedUser = useCallback(
    (nextUser: User, token?: string) => {
      if (token) setStoredToken(token);
      setUser(nextUser);
      if (nextUser.theme_preference) {
        setTheme(nextUser.theme_preference);
      }
    },
    [setTheme],
  );

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      if (me.theme_preference) {
        setTheme(me.theme_preference);
      }
    } catch {
      if (getStoredToken()) {
        setStoredToken(null);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      applyAuthenticatedUser(res.user, res.access_token);
      return res.user;
    },
    [applyAuthenticatedUser],
  );

  const register = useCallback(
    async (payload: {
      full_name: string;
      email: string;
      phone?: string;
      password: string;
      role: PublicRegisterRole;
      location?: string;
      language_preference?: FarmerLanguage;
    }) => {
      const res = await api.register(payload);
      applyAuthenticatedUser(res.user, res.access_token);
      return res.user;
    },
    [applyAuthenticatedUser],
  );

  const demoLogin = useCallback(
    async (role: UserRole) => {
      const res = await api.demoLogin(role);
      applyAuthenticatedUser(res.user, res.access_token);
      return res.user;
    },
    [applyAuthenticatedUser],
  );

  const firebaseGoogleLogin = useCallback(
    async (role: PublicRegisterRole = 'farmer') => {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await api.firebaseLogin({ idToken, role });
      applyAuthenticatedUser(res.user, res.access_token);
      try {
        const publicRole: PublicRegisterRole =
          res.user.role === 'admin' ? 'farmer' : (res.user.role as PublicRegisterRole);
        await syncUserProfileToFirestore({
          displayName: res.user.full_name,
          role: publicRole,
          themePreference: res.user.theme_preference,
          languagePreference: res.user.language_preference,
          email: res.user.email,
          phone: res.user.phone,
          location: res.user.location,
        });
      } catch (err) {
        console.warn('Firestore profile sync skipped:', err);
      }
      return res.user;
    },
    [applyAuthenticatedUser],
  );

  const googleDemoLogin = useCallback(
    async (payload: { email: string; full_name: string; role: PublicRegisterRole }) => {
      const res = await api.googleDemoLogin(payload);
      applyAuthenticatedUser(res.user, res.access_token);
      return res.user;
    },
    [applyAuthenticatedUser],
  );

  const verifyOtpDemo = useCallback(
    async (payload: { phone: string; otp_code: string; role: PublicRegisterRole; full_name?: string }) => {
      const res = await api.verifyOtpDemo(payload);
      applyAuthenticatedUser(res.user, res.access_token);
      return res.user;
    },
    [applyAuthenticatedUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear local session even if token already expired
    }
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      // Ignore Firebase sign-out cleanup errors
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(
    async (payload: {
      full_name?: string;
      phone?: string;
      location?: string;
      theme_preference?: ThemeMode;
      language_preference?: FarmerLanguage;
    }) => {
      const updated = await api.updateProfile(payload);
      setUser(updated);
      if (payload.theme_preference) {
        setTheme(payload.theme_preference);
      }
      if (auth.currentUser) {
        try {
          const publicRole: PublicRegisterRole =
            updated.role === 'admin' ? 'farmer' : (updated.role as PublicRegisterRole);
          await syncUserProfileToFirestore({
            displayName: updated.full_name,
            role: publicRole,
            themePreference: updated.theme_preference,
            languagePreference: updated.language_preference,
            email: updated.email,
            phone: updated.phone,
            location: updated.location,
          });
        } catch (err) {
          console.warn('Firestore profile update sync warning:', err);
        }
      }
      return updated;
    },
    [setTheme],
  );

  const deleteAccount = useCallback(async (payload: { confirmation: 'DELETE'; password?: string }) => {
    await api.deleteAccount(payload);
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        demoLogin,
        firebaseGoogleLogin,
        googleDemoLogin,
        verifyOtpDemo,
        logout,
        updateProfile,
        deleteAccount,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
