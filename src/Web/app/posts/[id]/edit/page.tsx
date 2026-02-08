'use client';

import { useAuth } from '@/contexts/AuthContext';
import {
    getPost,
    refreshPostEngagement,
    updatePost,
    type Post,
} from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const STATUSES = ['Draft', 'Scheduled', 'Published', 'Failed'];

const inputClass =
    'mt-1 block w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]';
const labelClass = 'block text-sm font-medium text-[var(--text)]';

function formatDateTimeLocal(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditPostPage() {
    const { appUser, idToken, loading: authLoading } = useAuth();
    const params = useParams();
    const id = params?.id as string;
    const postId = id ? parseInt(id, 10) : NaN;

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [topicSummary, setTopicSummary] = useState('');
    const [content, setContent] = useState('');
    const [script, setScript] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [status, setStatus] = useState('');
    const [refreshingEngagement, setRefreshingEngagement] = useState(false);

    const load = useCallback(async () => {
        if (!idToken || !Number.isInteger(postId) || postId < 1) return;
        setLoading(true);
        setError(null);
        try {
            const p = await getPost(idToken, postId);
            setPost(p);
            setTopicSummary(p.topicSummary ?? '');
            setContent(p.content ?? '');
            setScript(p.script ?? '');
            setScheduledAt(formatDateTimeLocal(p.scheduledAt));
            setStatus(p.status ?? 'Draft');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load post');
        } finally {
            setLoading(false);
        }
    }, [idToken, postId]);

    useEffect(() => {
        if (appUser && idToken && Number.isInteger(postId) && postId > 0)
            load();
        else if (!authLoading) setLoading(false);
    }, [appUser, idToken, authLoading, postId, load]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!idToken || !post || saving) return;
        setSaving(true);
        setError(null);
        try {
            const payload = {
                topicSummary: topicSummary || null,
                content: content || null,
                script: script || null,
                scheduledAt: scheduledAt
                    ? new Date(scheduledAt).toISOString()
                    : null,
                status,
            };
            const updated = await updatePost(idToken, postId, payload);
            setPost(updated);
            setStatus(updated.status ?? status);
            setScheduledAt(formatDateTimeLocal(updated.scheduledAt));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update post');
        } finally {
            setSaving(false);
        }
    };

    const handleRefreshEngagement = async () => {
        if (!idToken || !post?.externalPostId || refreshingEngagement) return;
        setRefreshingEngagement(true);
        setError(null);
        try {
            const updated = await refreshPostEngagement(idToken, post.id);
            setPost(updated);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to refresh engagement',
            );
        } finally {
            setRefreshingEngagement(false);
        }
    };

    if (authLoading || loading) {
        return (
            <main className="px-6 py-8">
                <p className="text-[var(--text-muted)]">Loading…</p>
            </main>
        );
    }
    if (!appUser) {
        return (
            <main className="px-6 py-8">
                <p className="text-[var(--text)]">Please sign in.</p>
                <Link
                    href="/"
                    className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
                >
                    Go home
                </Link>
            </main>
        );
    }
    if (!post || !Number.isInteger(postId) || postId < 1) {
        return (
            <main className="px-6 py-8">
                <p className="text-[var(--text)]">Post not found.</p>
                <Link
                    href="/posts"
                    className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
                >
                    Back to posts
                </Link>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-2xl px-6 py-8">
            <div className="mb-4 flex items-center gap-4">
                <Link
                    href="/posts"
                    className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
                >
                    Back to posts
                </Link>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text)]">
                Edit post {post.id}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
                Platform: {post.platform} · Created:{' '}
                {new Date(post.createdAt).toLocaleString()}
            </p>
            {post.externalPostId && (
                <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                    <span className="text-sm text-[var(--text-muted)]">
                        Views: {post.viewsCount ?? '—'} · Likes:{' '}
                        {post.likesCount ?? '—'} · Comments:{' '}
                        {post.commentsCount ?? '—'}
                    </span>
                    <button
                        type="button"
                        onClick={handleRefreshEngagement}
                        disabled={refreshingEngagement}
                        className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50"
                    >
                        {refreshingEngagement
                            ? 'Refreshing…'
                            : 'Refresh engagement'}
                    </button>
                </div>
            )}

            {error && (
                <p
                    className="mt-2 rounded bg-red-100 p-2 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                    role="alert"
                >
                    {error}
                </p>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                    <label htmlFor="topicSummary" className={labelClass}>
                        Topic summary
                    </label>
                    <input
                        id="topicSummary"
                        type="text"
                        value={topicSummary}
                        onChange={(e) => setTopicSummary(e.target.value)}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="content" className={labelClass}>
                        Content
                    </label>
                    <textarea
                        id="content"
                        rows={6}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="script" className={labelClass}>
                        Script (optional)
                    </label>
                    <textarea
                        id="script"
                        rows={3}
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="scheduledAt" className={labelClass}>
                        Scheduled at (optional)
                    </label>
                    <input
                        id="scheduledAt"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="status" className={labelClass}>
                        Status
                    </label>
                    <select
                        id="status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={inputClass}
                    >
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <Link
                        href="/posts"
                        className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--text)] hover:opacity-90"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </main>
    );
}
