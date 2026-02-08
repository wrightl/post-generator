"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getProfile,
  getCredentials,
  updateProfile,
  setCredential,
  type UserProfile,
  type SocialCredential,
} from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PLATFORM_KEYS: Record<string, string[]> = {
  LinkedIn: ["AccessToken", "PersonUrn"],
  Bluesky: ["Handle", "AppPassword", "PdsUrl"],
  Instagram: ["UserId", "AccessToken"],
  Facebook: ["PageId", "PageAccessToken"],
  TikTok: ["AccessToken"],
  Skool: ["ApiKey", "SessionId", "GroupId"],
};

const PREDEFINED_AVATARS = [
  { id: "1", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=1", label: "Avatar 1" },
  { id: "2", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=2", label: "Avatar 2" },
  { id: "3", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=3", label: "Avatar 3" },
  { id: "4", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=4", label: "Avatar 4" },
  { id: "5", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=5", label: "Avatar 5" },
  { id: "6", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=6", label: "Avatar 6" },
  { id: "7", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=7", label: "Avatar 7" },
  { id: "8", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=8", label: "Avatar 8" },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";
const labelClass = "block text-sm font-medium text-[var(--text)]";

export default function ProfilePage() {
  const { appUser, idToken, loading: authLoading, signOut, refreshAppUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [credentials, setCredentials] = useState<SocialCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentialDraft, setCredentialDraft] = useState<Record<string, Record<string, string>>>({});
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([getProfile(idToken), getCredentials(idToken)]);
      setProfile(p);
      setCredentials(c);
      if (p.preferredTheme === "light" || p.preferredTheme === "dark") setTheme(p.preferredTheme);
      const draft: Record<string, Record<string, string>> = {};
      c.forEach((cred) => {
        draft[cred.platform] = {};
        (PLATFORM_KEYS[cred.platform] ?? []).forEach((key) => {
          draft[cred.platform][key] = cred.credentials[key] === "***" ? "" : (cred.credentials[key] ?? "") ?? "";
        });
      });
      setCredentialDraft(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [idToken, setTheme]);

  useEffect(() => {
    if (appUser && idToken) load();
    else if (!authLoading) setLoading(false);
  }, [appUser, idToken, authLoading, load]);

  const handleThemeChange = async (newTheme: "light" | "dark") => {
    if (!idToken) return;
    setTheme(newTheme);
    setSavingTheme(true);
    setError(null);
    try {
      await updateProfile(idToken, { preferredTheme: newTheme, avatarUrl: profile?.avatarUrl ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save theme");
    } finally {
      setSavingTheme(false);
    }
  };

  const handleAvatarSelect = async (avatarUrl: string | null) => {
    if (!idToken) return;
    setSavingAvatar(true);
    setError(null);
    try {
      await updateProfile(idToken, { preferredTheme: profile?.preferredTheme ?? null, avatarUrl });
      setProfile((p) => (p ? { ...p, avatarUrl } : null));
      setCustomAvatarUrl("");
      await refreshAppUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save avatar");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      if (dataUrl.length > 2_000_000) {
        setError("Image is too large; use a smaller file or a URL instead.");
        return;
      }
      await handleAvatarSelect(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCredentialChange = (platform: string, key: string, value: string) => {
    setCredentialDraft((prev) => ({
      ...prev,
      [platform]: { ...(prev[platform] ?? {}), [key]: value },
    }));
  };

  const handleSaveCredential = async (platform: string) => {
    if (!idToken) return;
    const draft = credentialDraft[platform];
    if (!draft) return;
    const credentials: Record<string, string | null> = {};
    (PLATFORM_KEYS[platform] ?? []).forEach((key) => {
      const v = draft[key]?.trim();
      credentials[key] = v === "" ? null : v;
    });
    setSavingPlatform(platform);
    setError(null);
    try {
      await setCredential(idToken, platform, credentials);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingPlatform(null);
    }
  };

  if (authLoading || !appUser) {
    return (
      <main className="px-6 py-8">
        <p className="text-[var(--text)]">Please sign in to view your profile.</p>
        <Link href="/" className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
          Go home
        </Link>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text)]">Profile &amp; settings</h1>
      <p className="mt-1 text-[var(--text-muted)]">
        Manage your theme and social media API keys. Keys are stored securely per account.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-[var(--text-muted)]">Loading…</p>
      ) : (
        <div className="mt-6 space-y-8">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Profile avatar</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Choose an avatar from the list or upload your own. It appears next to your name in the menu.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PREDEFINED_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => handleAvatarSelect(av.url)}
                  disabled={savingAvatar}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 transition ${
                    profile?.avatarUrl === av.url
                      ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/30"
                      : "border-[var(--border)] hover:border-[var(--primary)]/50"
                  }`}
                  title={av.label}
                >
                  <img src={av.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className={labelClass}>Custom image URL</label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => handleAvatarSelect(customAvatarUrl.trim() || null)}
                disabled={savingAvatar || !customAvatarUrl.trim()}
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
              >
                Use URL
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]/30">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarUpload}
                  disabled={savingAvatar}
                />
              </label>
              {profile?.avatarUrl && (
                <button
                  type="button"
                  onClick={() => handleAvatarSelect(null)}
                  disabled={savingAvatar}
                  className="text-sm text-[var(--text-muted)] underline hover:text-[var(--text)]"
                >
                  Remove avatar
                </button>
              )}
            </div>
            {profile?.avatarUrl && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">Current avatar:</span>
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-[var(--border)]"
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Preferred theme</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Choose light or dark mode.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                disabled={savingTheme}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  theme === "light"
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:opacity-90"
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                disabled={savingTheme}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  theme === "dark"
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:opacity-90"
                }`}
              >
                Dark
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">Social media credentials</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Add API keys and tokens for each platform. Leave a field blank to keep the current value. Values are
              stored per user and never shared.
            </p>
            <div className="mt-4 space-y-6">
              {credentials.map((cred) => {
                const keys = PLATFORM_KEYS[cred.platform] ?? [];
                const draft = credentialDraft[cred.platform] ?? {};
                return (
                  <div
                    key={cred.platform}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4"
                  >
                    <h3 className="font-medium text-[var(--text)]">{cred.platform}</h3>
                    <div className="mt-3 space-y-2">
                      {keys.map((key) => (
                        <div key={key}>
                          <label className={labelClass}>
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </label>
                          <input
                            type="password"
                            autoComplete="off"
                            placeholder={cred.credentials[key] === "***" ? "•••••••• (leave blank to keep)" : "Enter value"}
                            value={draft[key] ?? ""}
                            onChange={(e) => handleCredentialChange(cred.platform, key, e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveCredential(cred.platform)}
                      disabled={savingPlatform === cred.platform}
                      className="mt-3 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                    >
                      {savingPlatform === cred.platform ? "Saving…" : "Save"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-red-500/10 hover:border-red-400/50 hover:text-red-600"
        >
          Logout
        </button>
        <Link href="/" className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
