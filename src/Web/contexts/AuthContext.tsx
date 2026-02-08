"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  type User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { API_URL, getProfile } from "@/lib/api";

export type AppUser = {
  id: number;
  email: string;
  name: string | null;
  preferredTheme: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type AuthMode = "choice" | "email-signin" | "email-create";

type AuthState = {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  idToken: string | null;
  loading: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthState & {
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshIdToken: () => Promise<string | null>;
  refreshAppUser: () => Promise<void>;
  authMode: AuthMode;
  setAuthMode: (m: AuthMode) => void;
} | null>(null);

async function syncUser(idToken: string): Promise<AppUser | null> {
  const res = await fetch(`${API_URL}/api/auth/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("choice");

  const refreshIdToken = useCallback(async (): Promise<string | null> => {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) return null;
    const token = await user.getIdToken(true);
    setIdToken(token);
    return token;
  }, []);

  const refreshAppUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    if (!token) return;
    try {
      const profile = await getProfile(token);
      setAppUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        preferredTheme: profile.preferredTheme,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt,
      });
    } catch {
      // ignore
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not configured");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setFirebaseUser(result.user);
      const token = await result.user.getIdToken();
      setIdToken(token);
      const app = await syncUser(token);
      setAppUser(app);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not configured");
      return;
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setFirebaseUser(result.user);
      const token = await result.user.getIdToken();
      setIdToken(token);
      const app = await syncUser(token);
      setAppUser(app);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      throw e;
    }
  }, []);

  const createAccount = useCallback(async (email: string, password: string) => {
    setError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase not configured");
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setFirebaseUser(result.user);
      const token = await result.user.getIdToken();
      setIdToken(token);
      const app = await syncUser(token);
      setAppUser(app);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create account failed");
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
    setFirebaseUser(null);
    setAppUser(null);
    setIdToken(null);
    setAuthMode("choice");
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
        const app = await syncUser(token);
        setAppUser(app);
      } else {
        setAppUser(null);
        setIdToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        idToken,
        loading,
        error,
        signInWithGoogle,
        signInWithEmail,
        createAccount,
        signOut,
        refreshIdToken,
        refreshAppUser,
        authMode,
        setAuthMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
