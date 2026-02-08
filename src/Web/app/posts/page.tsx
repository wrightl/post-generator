'use client';

import { useAuth } from '@/contexts/AuthContext';
import {
    deletePost,
    fetchPosts,
    generatePostImage,
    publishPostNow,
    type Post,
} from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const PAGE_SIZE = 10;
const selectClass =
    'rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]';
const btnClass =
    'rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed';

const iconBtnClass =
    'inline-flex items-center justify-center rounded p-2 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] disabled:opacity-50';

function formatScheduledAt(post: Post): string {
    if (post.scheduledAt)
        return new Date(post.scheduledAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    if (post.status === 'Draft') return 'Draft — not scheduled';
    return 'No schedule';
}

function IconEdit({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
    );
}
function IconImage({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
    );
}
function IconTrash({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" x2="10" y1="11" y2="17" />
            <line x1="14" x2="14" y1="11" y2="17" />
        </svg>
    );
}
function IconSend({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </svg>
    );
}

export default function PostsPage() {
    const { appUser, idToken, loading: authLoading } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<{
        platforms: string[];
        statuses: string[];
    }>({ platforms: [], statuses: [] });
    const [error, setError] = useState<string | null>(null);
    const [generatingImageId, setGeneratingImageId] = useState<number | null>(
        null,
    );
    const [publishNowPostId, setPublishNowPostId] = useState<number | null>(
        null,
    );
    const [publishingId, setPublishingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        if (!idToken) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPosts(idToken, {
                platforms:
                    filter.platforms.length > 0 ? filter.platforms : undefined,
                statuses:
                    filter.statuses.length > 0 ? filter.statuses : undefined,
                page,
                pageSize: PAGE_SIZE,
            });
            setPosts(data.items);
            setTotalCount(data.totalCount);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [idToken, filter.platforms, filter.statuses, page]);

    useEffect(() => {
        if (appUser && idToken) load();
        else if (!authLoading) setLoading(false);
    }, [appUser, idToken, authLoading, load]);

    useEffect(() => {
        setPage(1);
    }, [filter.platforms, filter.statuses]);

    useEffect(() => {
        if (publishNowPostId == null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPublishNowPostId(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [publishNowPostId]);

    const handleDelete = async (id: number) => {
        if (!idToken || !confirm('Delete this post?')) return;
        try {
            await deletePost(idToken, id);
            const wasLastOnPage = posts.length === 1 && page > 1;
            setPosts((prev) => prev.filter((p) => p.id !== id));
            setTotalCount((prev) => Math.max(0, prev - 1));
            if (wasLastOnPage) setPage((p) => p - 1);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed');
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
            setError(
                e instanceof Error ? e.message : 'Image generation failed',
            );
        } finally {
            setGeneratingImageId(null);
        }
    };

    const handlePublishNowConfirm = async () => {
        if (!idToken || publishNowPostId == null) return;
        setPublishingId(publishNowPostId);
        setError(null);
        try {
            const updated = await publishPostNow(idToken, publishNowPostId);
            setPosts((prev) =>
                prev.map((p) => (p.id === publishNowPostId ? updated : p)),
            );
            setPublishNowPostId(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to publish');
        } finally {
            setPublishingId(null);
        }
    };

    if (authLoading || !appUser) {
        return (
            <main className="px-6 py-8">
                <p className="text-[var(--text)]">
                    Please sign in to view posts.
                </p>
                <Link
                    href="/"
                    className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
                >
                    Go home
                </Link>
            </main>
        );
    }

    return (
        <main id="main" className="mx-auto max-w-4xl px-6 py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-[var(--text)]">
                    Your posts
                </h1>
                <Link
                    href="/generate"
                    className="rounded px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                >
                    Generate new series
                </Link>
            </div>

            <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-muted)]">
                        Platform
                    </span>
                    {[
                        'LinkedIn',
                        'Skool',
                        'Instagram',
                        'Bluesky',
                        'Facebook',
                        'TikTok',
                    ].map((value) => {
                        const selected = filter.platforms.includes(value);
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() =>
                                    setFilter((f) => ({
                                        ...f,
                                        platforms: selected
                                            ? f.platforms.filter(
                                                  (p) => p !== value,
                                              )
                                            : [...f.platforms, value],
                                    }))
                                }
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
                                    selected
                                        ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                                        : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                                }`}
                                aria-pressed={selected}
                                aria-label={`Filter by ${value}`}
                            >
                                {value}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-muted)]">
                        Status
                    </span>
                    {['Draft', 'Scheduled', 'Published', 'Failed'].map(
                        (value) => {
                            const selected = filter.statuses.includes(value);
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        setFilter((f) => ({
                                            ...f,
                                            statuses: selected
                                                ? f.statuses.filter(
                                                      (s) => s !== value,
                                                  )
                                                : [...f.statuses, value],
                                        }))
                                    }
                                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
                                        selected
                                            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                                            : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                                    }`}
                                    aria-pressed={selected}
                                    aria-label={`Filter by ${value}`}
                                >
                                    {value}
                                </button>
                            );
                        },
                    )}
                </div>
            </div>

            {error && (
                <p className="mt-2 text-red-600" role="alert">
                    {error}
                </p>
            )}
            {loading && (
                <div className="flex min-h-[40vh] items-center justify-center">
                    <p className="flex items-baseline gap-0.5 text-[var(--text-muted)]">
                        Rummaging through your posts
                        <span className="inline-flex" aria-hidden>
                            <span className="loading-rummage-dot loading-rummage-dot-1">
                                .
                            </span>
                            <span className="loading-rummage-dot loading-rummage-dot-2">
                                .
                            </span>
                            <span className="loading-rummage-dot loading-rummage-dot-3">
                                .
                            </span>
                        </span>
                    </p>
                </div>
            )}

            <ul className="mt-4 list-none space-y-3">
                {!loading && posts.length === 0 && (
                    <li className="text-[var(--text-muted)]">
                        No posts yet. Generate a new series to get started.
                    </li>
                )}
                {posts.map((p) => (
                    <li
                        key={p.id}
                        className="flex flex-col gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-4"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--text)]">
                                {formatScheduledAt(p)}
                            </span>
                            {p.status === 'Draft' && (
                                <button
                                    type="button"
                                    onClick={() => setPublishNowPostId(p.id)}
                                    className={iconBtnClass}
                                    aria-label="Post now"
                                    title="Post now"
                                >
                                    <IconSend />
                                </button>
                            )}
                        </div>
                        <p className="line-clamp-2 text-sm text-[var(--text-muted)]">
                            {p.content}
                        </p>
                        {p.imageUrl && (
                            <img
                                src={p.imageUrl}
                                alt=""
                                className="mt-1 max-h-24 rounded object-cover"
                            />
                        )}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                                <Link
                                    href={`/posts/${p.id}/edit`}
                                    className={iconBtnClass}
                                    aria-label="Edit post"
                                >
                                    <IconEdit />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => handleGenerateImage(p.id)}
                                    disabled={generatingImageId === p.id}
                                    className={iconBtnClass}
                                    aria-label={
                                        generatingImageId === p.id
                                            ? 'Generating image…'
                                            : 'Generate image'
                                    }
                                >
                                    <IconImage />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(p.id)}
                                    className={`${iconBtnClass} text-red-600 hover:text-red-700`}
                                    aria-label="Delete post"
                                >
                                    <IconTrash />
                                </button>
                            </div>
                            <span
                                className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]"
                                aria-label={`Platform: ${p.platform}`}
                            >
                                {p.platform}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>

            {!loading && totalCount > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
                    <span aria-live="polite">
                        {(page - 1) * PAGE_SIZE + 1}–
                        {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className={btnClass}
                            aria-label="Previous page"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page * PAGE_SIZE >= totalCount}
                            className={btnClass}
                            aria-label="Next page"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            <p className="mt-6">
                <Link
                    href="/"
                    className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
                >
                    Back to home
                </Link>
            </p>

            {publishNowPostId != null && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="publish-now-title"
                    aria-describedby="publish-now-desc"
                    onClick={() => setPublishNowPostId(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2
                            id="publish-now-title"
                            className="text-lg font-semibold text-[var(--text)]"
                        >
                            Post now?
                        </h2>
                        <p
                            id="publish-now-desc"
                            className="mt-2 text-sm text-[var(--text-muted)]"
                        >
                            {(() => {
                                const post = posts.find(
                                    (q) => q.id === publishNowPostId,
                                );
                                return post
                                    ? `This draft will be published to ${post.platform} immediately. Continue?`
                                    : 'Publish this post now?';
                            })()}
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPublishNowPostId(null)}
                                className={btnClass}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handlePublishNowConfirm}
                                disabled={publishingId !== null}
                                className="rounded px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
                            >
                                {publishingId === publishNowPostId
                                    ? 'Publishing…'
                                    : 'Post now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
