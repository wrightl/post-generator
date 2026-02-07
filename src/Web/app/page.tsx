"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function Home() {
  const { appUser, loading, error, signInWithGoogle, signInWithEmail, createAccount, authMode, setAuthMode } = useAuth();

  if (loading) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-red-600" role="alert">{error}</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-3 rounded-lg px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-8">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
        <h1 className="text-3xl font-bold text-[var(--text)]">Post Generator</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          AI-powered social media post scheduler. Create an account or sign in to get started.
        </p>
      </div>
      {appUser ? (
        <div className="mt-8 space-y-4">
          <p className="text-[var(--text)]">
            Signed in as <strong>{appUser.email}</strong>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/posts"
              className="button-fun rounded-xl px-5 py-2.5 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] font-medium transition"
            >
              View posts
            </Link>
            <Link
              href="/generate"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-[var(--text)] hover:bg-[var(--surface-hover)] font-medium transition"
            >
              Generate new series
            </Link>
            <Link
              href="/profile"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-[var(--text)] hover:bg-[var(--surface-hover)] font-medium transition"
            >
              Profile
            </Link>
          </div>
        </div>
      ) : (
        <AuthSection
          signInWithGoogle={signInWithGoogle}
          signInWithEmail={signInWithEmail}
          createAccount={createAccount}
          authMode={authMode}
          setAuthMode={setAuthMode}
        />
      )}
    </main>
  );
}

function AuthSection({
  signInWithGoogle,
  signInWithEmail,
  createAccount,
  authMode,
  setAuthMode,
}: {
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  authMode: "choice" | "email-signin" | "email-create";
  setAuthMode: (m: "choice" | "email-signin" | "email-create") => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const handleBack = () => {
    setErr(null);
    setAuthMode("choice");
  };
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password) {
      setErr("Email and password required");
      return;
    }
    setSubmitting(true);
    try {
      if (authMode === "email-create") await createAccount(email.trim(), password);
      else await signInWithEmail(email.trim(), password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };
  if (authMode === "email-signin" || authMode === "email-create") {
    return (
      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          {authMode === "email-create" ? "Create account" : "Sign in with email"}
        </h2>
        <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-[var(--text)]">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-[var(--text)]">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={authMode === "email-create" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {submitting ? "Please wait…" : authMode === "email-create" ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-hover)]"
            >
              Back
            </button>
          </div>
        </form>
      </div>
    );
  }
  return (
    <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <h2 className="text-lg font-semibold text-[var(--text)]">Sign in or create an account</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Use any of the options below.</p>
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={signInWithGoogle}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] hover:bg-[var(--surface-hover)] font-medium transition"
        >
          <span aria-hidden>G</span> Sign in with Google
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("email-signin")}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] hover:bg-[var(--surface-hover)] font-medium transition"
        >
          Sign in with email
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("email-create")}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 text-[var(--primary)] hover:bg-[var(--primary)]/20 font-medium transition"
        >
          Create account (email)
        </button>
      </div>
    </div>
  );
}
