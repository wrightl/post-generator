'use client';

import { PostImage } from '@/components/PostImage';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
    getDashboardStats,
    refreshPostEngagement,
    type DashboardStats,
    type Post,
} from '@/lib/api';

export default function Home() {
    const { appUser, loading, error } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        setStatsError(null);
        try {
            const data = await getDashboardStats();
            setStats(data);
        } catch (e) {
            setStatsError(
                e instanceof Error ? e.message : 'Failed to load stats',
            );
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (appUser) loadStats();
        else setStats(null);
    }, [appUser, loadStats]);

    if (loading) {
        return (
            <main id="main" className="mx-auto max-w-6xl px-4 py-8">
                <p className="text-[var(--text-muted)]">Loading…</p>
            </main>
        );
    }
    if (error) {
        return (
            <main id="main" className="mx-auto max-w-6xl px-4 py-8">
                <p className="text-red-600" role="alert">
                    {error}
                </p>
                <Link
                    href="/sign-in"
                    className="mt-3 inline-block rounded-lg px-4 py-2 bg-[var(--primary)] text-[var(--primary-btn-text)] hover:bg-[var(--primary-hover)]"
                >
                    Try again
                </Link>
            </main>
        );
    }

    return (
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
                <h1 className="text-3xl font-bold text-[var(--text)]">
                    Post Generator
                </h1>
                <p className="mt-2 text-[var(--text-muted)]">
                    AI-powered social media post scheduler. Create an account or
                    sign in to get started.
                </p>
            </div>
            {appUser ? (
                <DashboardSection
                    stats={stats}
                    statsLoading={statsLoading}
                    statsError={statsError}
                    onRefresh={loadStats}
                    onRefreshEngagement={async (postId) => {
                        await refreshPostEngagement(postId);
                        loadStats();
                    }}
                />
            ) : (
                <AuthSection />
            )}
        </main>
    );
}

function DashboardSection({
    stats,
    statsLoading,
    statsError,
    onRefresh,
    onRefreshEngagement,
}: {
    stats: DashboardStats | null;
    statsLoading: boolean;
    statsError: string | null;
    onRefresh: () => void;
    onRefreshEngagement?: (postId: number) => Promise<void>;
}) {
    if (statsLoading && !stats) {
        return (
            <div className="mt-8">
                <p className="text-[var(--text-muted)]">Loading dashboard…</p>
            </div>
        );
    }

    if (statsError && !stats) {
        return (
            <div className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 p-4">
                <p className="text-red-600">{statsError}</p>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-2 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[var(--primary-btn-text)] text-sm"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!stats) return null;

    const maxPlatformCount = Math.max(
        1,
        ...stats.byPlatform.map((p) => p.count),
    );
    const topPlatform = stats.byPlatform[0]?.platform ?? '—';

    return (
        <div className="mt-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-[var(--text)]">
                    Dashboard
                </h2>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/posts"
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
                    >
                        View all posts
                    </Link>
                    <Link
                        href="/generate"
                        className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-btn-text)] hover:bg-[var(--primary-hover)]"
                    >
                        Generate new series
                    </Link>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Total posts" value={stats.totalPosts} />
                <StatCard label="Drafts" value={stats.draftCount} />
                <StatCard label="Scheduled" value={stats.scheduledCount} />
                <StatCard label="Published" value={stats.publishedCount} />
                <StatCard label="Failed" value={stats.failedCount} />
                <StatCard label="Top platform" value={topPlatform} sub />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Posts by platform (bar chart) */}
                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                    <h3 className="text-lg font-semibold text-[var(--text)]">
                        Posts by platform
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Your most used channel is <strong>{topPlatform}</strong>
                    </p>
                    <div className="mt-4 space-y-3">
                        {stats.byPlatform.length === 0 ? (
                            <p className="text-sm text-[var(--text-muted)]">
                                No posts yet. Generate a series to get started.
                            </p>
                        ) : (
                            stats.byPlatform.map(({ platform, count }) => (
                                <div
                                    key={platform}
                                    className="flex items-center gap-3"
                                >
                                    <span className="w-24 shrink-0 text-sm font-medium text-[var(--text)]">
                                        {platform}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div
                                            className="h-8 rounded-lg bg-[var(--primary)]/20 transition-all"
                                            style={{
                                                width: `${(count / maxPlatformCount) * 100}%`,
                                                minWidth:
                                                    count > 0 ? '2rem' : 0,
                                            }}
                                        />
                                    </div>
                                    <span className="w-8 shrink-0 text-right text-sm text-[var(--text-muted)]">
                                        {count}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Upcoming posts */}
                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                    <h3 className="text-lg font-semibold text-[var(--text)]">
                        Upcoming
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {stats.scheduledCount} post
                        {stats.scheduledCount !== 1 ? 's' : ''} scheduled
                    </p>
                    <ul className="mt-4 space-y-2">
                        {stats.upcomingPosts.length === 0 ? (
                            <li className="text-sm text-[var(--text-muted)]">
                                No upcoming posts. Schedule some from your posts
                                list.
                            </li>
                        ) : (
                            stats.upcomingPosts.slice(0, 5).map((u) => (
                                <li
                                    key={u.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-[var(--text)]">
                                            {u.topicSummary || 'Untitled'}
                                        </span>
                                        <span className="text-xs text-[var(--text-muted)]">
                                            {u.platform} ·{' '}
                                            {new Date(
                                                u.scheduledAt,
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <Link
                                        href={`/posts/${u.id}/edit`}
                                        className="shrink-0 text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]"
                                    >
                                        Edit
                                    </Link>
                                </li>
                            ))
                        )}
                    </ul>
                    {stats.scheduledCount > 5 && (
                        <Link
                            href="/posts?status=Scheduled"
                            className="mt-2 block text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]"
                        >
                            View all scheduled →
                        </Link>
                    )}
                </section>
            </div>

            {/* Most recent published + engagement */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
                <h3 className="text-lg font-semibold text-[var(--text)]">
                    Most recent published post
                </h3>
                {stats.mostRecentPublished ? (
                    <RecentPublishedCard
                        post={stats.mostRecentPublished}
                        onRefreshEngagement={onRefreshEngagement}
                    />
                ) : (
                    <p className="mt-4 text-sm text-[var(--text-muted)]">
                        No published posts yet. Publish from your posts list to
                        see the latest here.
                    </p>
                )}
            </section>
        </div>
    );
}

function RecentPublishedCard({
    post,
    onRefreshEngagement,
}: {
    post: Post;
    onRefreshEngagement?: (postId: number) => Promise<void>;
}) {
    const [refreshing, setRefreshing] = useState(false);
    const hasEngagement = post.externalPostId != null;
    const views = post.viewsCount ?? null;
    const likes = post.likesCount ?? null;
    const comments = post.commentsCount ?? null;
    const engagementLabel =
        views != null || likes != null || comments != null
            ? [
                  views != null && `Views ${views}`,
                  likes != null && `Likes ${likes}`,
                  comments != null && `Comments ${comments}`,
              ]
                  .filter(Boolean)
                  .join(' · ')
            : hasEngagement
              ? '—'
              : null;

    const handleRefresh = async () => {
        if (!onRefreshEngagement) return;
        setRefreshing(true);
        try {
            await onRefreshEngagement(post.id);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <PostImage
                postId={post.id}
                hasImage={!!post.imageUrl}
                className="h-32 w-full shrink-0 rounded-lg object-cover sm:w-48"
            />
            <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--text-muted)]">
                    {post.platform} ·{' '}
                    {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString()
                        : '—'}
                </p>
                <p className="mt-1 line-clamp-2 text-[var(--text)]">
                    {post.content}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                    <Link
                        href={`/posts/${post.id}/edit`}
                        className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]"
                    >
                        View post
                    </Link>
                    {engagementLabel != null && (
                        <span className="text-xs text-[var(--text-muted)]">
                            {engagementLabel}
                        </span>
                    )}
                    {hasEngagement && onRefreshEngagement && (
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50"
                        >
                            {refreshing ? 'Refreshing…' : 'Refresh engagement'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    sub,
}: {
    label: string;
    value: number | string;
    sub?: boolean;
}) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {label}
            </p>
            <p
                className={`mt-1 font-semibold text-[var(--text)] ${sub ? 'truncate text-base' : 'text-2xl'}`}
            >
                {value}
            </p>
        </div>
    );
}

function AuthSection() {
    return (
        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
            <h2 className="text-lg font-semibold text-[var(--text)]">
                Sign in or create an account
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
                Use Clerk to sign in with Google, email, or other providers.
            </p>
            <div className="mt-4 flex flex-col gap-3">
                <Link
                    href="/sign-in"
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] hover:bg-[var(--surface-hover)] font-medium transition"
                >
                    Sign in
                </Link>
                <Link
                    href="/sign-up"
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 text-[var(--primary)] hover:bg-[var(--primary)]/20 font-medium transition"
                >
                    Create account
                </Link>
            </div>
        </div>
    );
}
