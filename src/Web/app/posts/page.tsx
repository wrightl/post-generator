"use client";

import { useAuth } from "@/contexts/AuthContext";
import { deletePost, fetchPosts, generatePostImage, type Post } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const selectClass =
  "rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";

export default function PostsPage() {
  const { appUser, idToken, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ platform?: string; status?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPosts(idToken, filter);
      setPosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [idToken, filter.platform, filter.status]);

  useEffect(() => {
    if (appUser && idToken) load();
    else if (!authLoading) setLoading(false);
  }, [appUser, idToken, authLoading, load]);

  const handleDelete = async (id: number) => {
    if (!idToken || !confirm("Delete this post?")) return;
    try {
      await deletePost(idToken, id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleGenerateImage = async (id: number) => {
    if (!idToken) return;
    setGeneratingImageId(id);
    setError(null);
    try {
      const updated = await generatePostImage(idToken, id);
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setGeneratingImageId(null);
    }
  };

  if (authLoading || !appUser) {
    return (
      <main className="px-6 py-8">
        <p className="text-[var(--text)]">Please sign in to view posts.</p>
        <Link href="/" className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
          Go home
        </Link>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text)]">Your posts</h1>
        <Link
          href="/generate"
          className="rounded px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
        >
          Generate new series
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          aria-label="Filter by platform"
          value={filter.platform ?? ""}
          onChange={(e) => setFilter((f) => ({ ...f, platform: e.target.value || undefined }))}
          className={selectClass}
        >
          <option value="">All platforms</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Skool">Skool</option>
          <option value="Instagram">Instagram</option>
          <option value="Bluesky">Bluesky</option>
          <option value="Facebook">Facebook</option>
          <option value="TikTok">TikTok</option>
        </select>
        <select
          aria-label="Filter by status"
          value={filter.status ?? ""}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
          className={selectClass}
        >
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Published">Published</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {error && <p className="mt-2 text-red-600" role="alert">{error}</p>}
      {loading && <p className="mt-2 text-[var(--text-muted)]">Loading…</p>}

      <ul className="mt-4 list-none space-y-3">
        {!loading && posts.length === 0 && (
          <li className="text-[var(--text-muted)]">No posts yet. Generate a new series to get started.</li>
        )}
        {posts.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-[var(--text)]">{p.platform}</span>
              <span className="text-sm text-[var(--text-muted)]">{p.status}</span>
            </div>
            <p className="line-clamp-2 text-sm text-[var(--text-muted)]">{p.content}</p>
            {p.imageUrl && (
              <img src={p.imageUrl} alt="" className="mt-2 max-h-24 rounded object-cover" />
            )}
            <div className="text-xs text-[var(--text-muted)]">
              {p.scheduledAt ? `Scheduled: ${new Date(p.scheduledAt).toLocaleString()}` : "No schedule"}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Link
                href={`/posts/${p.id}/edit`}
                className="text-sm text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => handleGenerateImage(p.id)}
                disabled={generatingImageId === p.id}
                className="text-sm text-[var(--primary)] underline hover:text-[var(--primary-hover)] disabled:opacity-50"
              >
                {generatingImageId === p.id ? "Generating…" : "Generate image"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="text-sm text-red-600 underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6">
        <Link href="/" className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
          Back to home
        </Link>
      </p>
    </main>
  );
}
