'use client';

import { useAuth } from '@/contexts/AuthContext';
import {
    generateSeriesStream,
    publishGeneratedSeries,
    type GenerateSeriesPayload,
    type Post,
} from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const PENDING_PAYLOAD_KEY = 'postGenerator.pendingSeriesPayload';

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

export default function PostsGeneratingPage() {
    const { appUser, idToken, loading: authLoading } = useAuth();
    const router = useRouter();
    const [seriesPayload, setSeriesPayload] = useState<GenerateSeriesPayload | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [expectedCount, setExpectedCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const startedRef = useRef(false);
    const mountedRef = useRef(true);
    const hasUnsavedPostsRef = useRef(false);
    const routerRef = useRef(router);

    useEffect(() => {
        mountedRef.current = true;
        routerRef.current = router;
        return () => {
            mountedRef.current = false;
        };
    }, [router]);

    const hasUnsavedPosts = Boolean(done && posts.length > 0 && !publishing);
    useEffect(() => {
        hasUnsavedPostsRef.current = hasUnsavedPosts;
    }, [hasUnsavedPosts]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!hasUnsavedPostsRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        const nav = (window as unknown as { navigation?: { addEventListener: (type: string, cb: (ev: unknown) => void) => void; removeEventListener: (type: string, cb: (ev: unknown) => void) => void } }).navigation;
        const handleNavigate = (ev: unknown) => {
            const e = ev as { destination: { url: string }; preventDefault(): void; canIntercept: boolean };
            if (!hasUnsavedPostsRef.current || !e.canIntercept) return;
            const dest = new URL(e.destination.url);
            const current = new URL(window.location.href);
            if (dest.pathname === current.pathname && dest.search === current.search) return;
            e.preventDefault();
            if (window.confirm('You have unpublished posts. Leave without saving?')) {
                routerRef.current.push(dest.pathname + dest.search);
            }
        };
        nav?.addEventListener('navigate', handleNavigate);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            nav?.removeEventListener('navigate', handleNavigate);
        };
    }, []);

    useEffect(() => {
        if (authLoading || !appUser || !idToken || startedRef.current) return;

        const raw =
            typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem(PENDING_PAYLOAD_KEY)
                : null;
        if (!raw) {
            router.replace('/generate');
            return;
        }

        let payload: GenerateSeriesPayload;
        try {
            payload = JSON.parse(raw) as GenerateSeriesPayload;
        } catch {
            router.replace('/generate');
            return;
        }

        setSeriesPayload(payload);
        sessionStorage.removeItem(PENDING_PAYLOAD_KEY);
        startedRef.current = true;
        setExpectedCount(payload.numPosts);

        (async () => {
            if (!mountedRef.current) return;
            setLoading(true);
            setError(null);
            try {
                for await (const event of generateSeriesStream(
                    idToken,
                    payload,
                )) {
                    if (!mountedRef.current) return;
                    if ('post' in event)
                        setPosts((prev) => [...prev, event.post]);
                    if ('error' in event) {
                        setError(event.error);
                        setLoading(false);
                        return;
                    }
                }
                if (mountedRef.current) setDone(true);
            } catch (e) {
                if (mountedRef.current)
                    setError(
                        e instanceof Error ? e.message : 'Generation failed',
                    );
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        })();
        // Do not abort on cleanup: effect can re-run when auth deps change and would cancel the request.
        // We only guard setState with mountedRef so we don't update after unmount.
    }, [appUser, idToken, authLoading, router]);

    const handlePublish = async () => {
        if (!idToken || !seriesPayload || posts.length === 0 || publishing) return;
        setPublishing(true);
        setError(null);
        try {
            await publishGeneratedSeries(idToken, {
                topicDetail: seriesPayload.topicDetail,
                numPosts: seriesPayload.numPosts,
                platform: seriesPayload.platform,
                generatedPosts: posts.map((p) => ({
                    content: p.content,
                    script: p.script ?? null,
                    metadataJson: p.metadataJson ?? null,
                    imageUrl: p.imageUrl ?? null,
                })),
                linked: seriesPayload.linked,
                tone: seriesPayload.tone,
                length: seriesPayload.length,
                generateImages: seriesPayload.generateImages,
                tiktokScriptDurationSeconds:
                    seriesPayload.tiktokScriptDurationSeconds,
                startDate: seriesPayload.startDate ?? null,
                recurrence: seriesPayload.recurrence ?? null,
                scheduledTimeOfDay: seriesPayload.scheduledTimeOfDay ?? null,
            });
            router.push('/posts');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to publish');
        } finally {
            setPublishing(false);
        }
    };

    if (authLoading || !appUser) {
        return (
            <main className="px-6 py-8">
                <p className="text-[var(--text-muted)]">Loading…</p>
                {!authLoading && !appUser && (
                    <Link
                        href="/"
                        className="mt-2 inline-block text-[var(--primary)] underline hover:text-[var(--primary-hover)]"
                    >
                        Go home
                    </Link>
                )}
            </main>
        );
    }

    return (
        <main id="main" className="mx-auto max-w-4xl px-6 py-8">
            <h1 className="text-2xl font-bold text-[var(--text)]">
                Generating posts
            </h1>
            {loading && (
                <p className="mt-2 text-[var(--text-muted)]">
                    Generating…{' '}
                    {posts.length > 0
                        ? `${posts.length} post${posts.length === 1 ? '' : 's'} so far.`
                        : ''}
                </p>
            )}
            {done && (
                <p className="mt-2 text-[var(--text-muted)]">
                    Done. {posts.length} post{posts.length === 1 ? '' : 's'}{' '}
                    created. Publish to save them to your account.
                </p>
            )}
            {done && posts.length > 0 && (
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={handlePublish}
                        disabled={publishing}
                        className="rounded-lg px-5 py-2.5 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 font-medium transition-colors"
                    >
                        {publishing ? 'Publishing…' : 'Publish'}
                    </button>
                </div>
            )}
            {error && (
                <p className="mt-2 text-red-600" role="alert">
                    {error}
                </p>
            )}

            <ul className="mt-4 list-none space-y-3">
                {Array.from({ length: expectedCount ?? 0 }, (_, i) => {
                    const post = posts[i];
                    if (post) {
                        const isPersisted = post.id > 0;
                        return (
                            <li
                                key={isPersisted ? `post-${post.id}` : `post-${i}`}
                                className="flex flex-col gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-4"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-[var(--text)]">
                                        {formatScheduledAt(post)}
                                    </span>
                                </div>
                                <p className="line-clamp-2 text-sm text-[var(--text-muted)]">
                                    {post.content}
                                </p>
                                {post.imageUrl && (
                                    <img
                                        src={post.imageUrl}
                                        alt=""
                                        className="mt-1 max-h-24 rounded object-cover"
                                    />
                                )}
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        {isPersisted ? (
                                            <Link
                                                href={`/posts/${post.id}/edit`}
                                                className={iconBtnClass}
                                                aria-label="Edit post"
                                            >
                                                <IconEdit />
                                            </Link>
                                        ) : null}
                                    </div>
                                    <span
                                        className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]"
                                        aria-label={`Platform: ${post.platform}`}
                                    >
                                        {post.platform}
                                    </span>
                                </div>
                            </li>
                        );
                    }
                    return (
                        <li
                            key={`skeleton-${i}`}
                            className="flex flex-col gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-4"
                            aria-busy="true"
                            aria-label={`Generating post ${i + 1} of ${expectedCount}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="h-4 w-36 animate-pulse rounded bg-[var(--border)]" />
                            </div>
                            <div className="space-y-1">
                                <span className="block h-3 w-full animate-pulse rounded bg-[var(--border)]" />
                                <span className="block h-3 w-3/4 animate-pulse rounded bg-[var(--border)]" />
                            </div>
                            <div className="mt-1 h-24 w-full animate-pulse rounded bg-[var(--border)]" />
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="h-8 w-8 animate-pulse rounded bg-[var(--border)]" />
                                <span className="h-5 w-20 animate-pulse rounded-full bg-[var(--border)]" />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </main>
    );
}
