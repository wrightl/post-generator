"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useUser, useClerk } from "@clerk/nextjs";

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
  appUser: AppUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
  authMode: AuthMode;
  setAuthMode: (m: AuthMode) => void;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchAppUser(): Promise<AppUser | null> {
  const res = await fetch("/api/users/me/profile", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    preferredTheme: data.preferredTheme,
    avatarUrl: data.avatarUrl,
    createdAt: data.createdAt,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("choice");

  const refreshAppUser = useCallback(async () => {
    try {
      const profile = await fetchAppUser();
      setAppUser(profile);
    } catch {
      setAppUser(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (clerkSignOut) await clerkSignOut();
    setAppUser(null);
    setAuthMode("choice");
  }, [clerkSignOut]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setAppUser(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchAppUser().then((profile) => {
      if (!cancelled) {
        setAppUser(profile);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isLoaded]);

  return (
    <AuthContext.Provider
      value={{
        appUser,
        loading,
        error,
        signOut,
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
