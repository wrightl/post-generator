"use client";

import { useAuth } from "@/contexts/AuthContext";
import { generateSeriesStream, type GenerateSeriesPayload, type Post } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PENDING_PAYLOAD_KEY = "postGenerator.pendingSeriesPayload";

export default function PostsGeneratingPage() {
  const { appUser, idToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !appUser || !idToken || startedRef.current) return;

    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(PENDING_PAYLOAD_KEY) : null;
    if (!raw) {
      router.replace("/generate");
      return;
    }

    let payload: GenerateSeriesPayload;
    try {
      payload = JSON.parse(raw) as GenerateSeriesPayload;
    } catch {
      router.replace("/generate");
      return;
    }

    sessionStorage.removeItem(PENDING_PAYLOAD_KEY);
    startedRef.current = true;

    (async () => {
      if (!mountedRef.current) return;
      setLoading(true);
      setError(null);
      try {
        for await (const event of generateSeriesStream(idToken, payload)) {
          if (!mountedRef.current) return;
          if ("seriesId" in event) setSeriesId(event.seriesId);
          if ("post" in event) setPosts((prev) => [...prev, event.post]);
          if ("error" in event) {
            setError(event.error);
            setLoading(false);
            return;
          }
        }
        if (mountedRef.current) setDone(true);
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    // Do not abort on cleanup: effect can re-run when auth deps change and would cancel the request.
    // We only guard setState with mountedRef so we don't update after unmount.
  }, [appUser, idToken, authLoading, router]);

  if (authLoading || !appUser) {
    return (
      <main className="px-6 py-8">
        <p className="text-[var(--text-muted)]">Loading…</p>
        {!authLoading && !appUser && (
          <Link href="/" className="mt-2 inline-block text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
            Go home
          </Link>
        )}
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-bold text-[var(--text)]">Generating posts</h1>
      {loading && (
        <p className="mt-2 text-[var(--text-muted)]">
          Generating… {posts.length > 0 ? `${posts.length} post${posts.length === 1 ? "" : "s"} so far.` : ""}
        </p>
      )}
      {done && (
        <p className="mt-2 text-[var(--text-muted)]">
          Done. {posts.length} post{posts.length === 1 ? "" : "s"} created.
        </p>
      )}
      {error && (
        <p className="mt-2 text-red-600" role="alert">
          {error}
        </p>
      )}

      <ul className="mt-4 list-none space-y-3">
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
            <div className="mt-1">
              <Link
                href={`/posts/${p.id}/edit`}
                className="text-sm text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
              >
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        {(done || error) && (
          <Link
            href="/posts"
            className="rounded px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
          >
            View all posts
          </Link>
        )}
        <Link href="/generate" className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--text)] hover:opacity-90">
          Generate another series
        </Link>
        <Link href="/" className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
