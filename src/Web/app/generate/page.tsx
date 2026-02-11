'use client';

import { useAuth } from '@/contexts/AuthContext';
import type { GenerateSeriesPayload } from '@/lib/api';
import { VoiceInput } from '@/components/VoiceInput';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

const PLATFORMS = [
    'LinkedIn',
    'Skool',
    'Instagram',
    'Bluesky',
    'Facebook',
    'TikTok',
] as const;
const TONES = [
    'Professional',
    'Casual',
    'Friendly',
    'Authoritative',
    'Inspirational',
];
const LENGTHS = ['Short', 'Medium', 'Long'];

const inputClass =
    'mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent transition-shadow';
const labelClass = 'block text-sm font-medium text-[var(--text)]';
const btnPrimary =
    'rounded-lg px-5 py-2.5 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 font-medium transition-colors';
const btnSecondary =
    'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors';

export default function GeneratePage() {
    const { appUser, idToken, loading: authLoading } = useAuth();
    const router = useRouter();
    const [topicDetail, setTopicDetail] = useState('');
    const [numPosts, setNumPosts] = useState<number | ''>(5);
    const [platform, setPlatform] = useState<string>('');
    const [linked, setLinked] = useState(false);
    const [tone, setTone] = useState('Friendly');
    const [length, setLength] = useState('Medium');
    const [generateImages, setGenerateImages] = useState(false);
    const [tiktokScriptDurationSeconds, setTiktokScriptDurationSeconds] =
        useState<number | ''>(60);
    const [startDate, setStartDate] = useState('');
    const [recurrence, setRecurrence] = useState('daily');
    const [scheduledTimeOfDay, setScheduledTimeOfDay] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [liveTranscript, setLiveTranscript] = useState('');

    const appendTopicWithVoice = useCallback((text: string) => {
        setTopicDetail((prev) => (prev ? `${prev} ${text}` : text));
        setLiveTranscript('');
    }, []);

    const setVoiceInterim = useCallback((text: string) => {
        setLiveTranscript(text);
    }, []);

    const PENDING_PAYLOAD_KEY = 'postGenerator.pendingSeriesPayload';

    const MIN_SCHEDULE_MINUTES_FROM_NOW = 30;

    const effectiveTopic = [topicDetail, liveTranscript].filter(Boolean).join(' ').trim();

    function validate(): string | null {
        const topic = effectiveTopic;
        if (!topic) return 'Please enter a topic.';

        const parsedNum = numPosts === '' ? NaN : Number(numPosts);
        if (!Number.isInteger(parsedNum) || parsedNum < 1 || parsedNum > 20) {
            return 'Number of posts must be a whole number between 1 and 20.';
        }

        if (!platform) return 'Please select a platform.';

        if (!startDate.trim()) return 'Please enter a schedule start date.';
        if (!scheduledTimeOfDay.trim())
            return 'Please enter a schedule time of day.';

        const scheduleDate = new Date(`${startDate}T${scheduledTimeOfDay}`);
        if (Number.isNaN(scheduleDate.getTime()))
            return 'Please enter a valid date and time.';
        const minTime = new Date(
            Date.now() + MIN_SCHEDULE_MINUTES_FROM_NOW * 60 * 1000,
        );
        if (scheduleDate.getTime() < minTime.getTime()) {
            return `Start date & time must be at least ${MIN_SCHEDULE_MINUTES_FROM_NOW} minutes in the future.`;
        }

        return null;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!idToken) return;
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const resolvedNumPosts =
                numPosts === '' ? 5 : Math.floor(Number(numPosts));
            const payload: GenerateSeriesPayload = {
                topicDetail: effectiveTopic,
                numPosts: Math.max(1, Math.min(20, resolvedNumPosts)),
                platform,
                linked,
                tone,
                length,
                generateImages,
                startDate: startDate.trim(),
                recurrence,
                scheduledTimeOfDay: scheduledTimeOfDay.trim(),
            };
            if (
                platform === 'TikTok' &&
                typeof tiktokScriptDurationSeconds === 'number'
            )
                payload.tiktokScriptDurationSeconds =
                    tiktokScriptDurationSeconds;
            if (typeof sessionStorage !== 'undefined')
                sessionStorage.setItem(
                    PENDING_PAYLOAD_KEY,
                    JSON.stringify(payload),
                );
            router.push('/posts/generating');
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to start generation',
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <main className="px-6 py-8">
                <p className="text-[var(--text-muted)]">Loading…</p>
            </main>
        );
    }
    if (!appUser) {
        return (
            <main className="px-6 py-8">
                <p className="text-[var(--text)]">
                    Please sign in to generate posts.
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
        <main className="flex min-h-[calc(100vh-4rem)]">
            {/* Left pane: options */}
            <aside className="w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-5 overflow-y-auto">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
                    Options
                </h2>
                <div className="space-y-5">
                    <div>
                        <label htmlFor="numPosts" className={labelClass}>
                            Number of posts
                        </label>
                        <input
                            id="numPosts"
                            type="number"
                            min={1}
                            max={20}
                            step={1}
                            value={numPosts}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') setNumPosts('');
                                else {
                                    const n = Math.floor(Number(v));
                                    if (!Number.isNaN(n)) setNumPosts(n);
                                }
                            }}
                            className={`${inputClass} ${error?.toLowerCase().includes('number') || error?.toLowerCase().includes('posts') ? 'border-red-500 focus:ring-red-500' : ''}`}
                            aria-invalid={
                                error?.toLowerCase().includes('number') ||
                                error?.toLowerCase().includes('posts')
                                    ? true
                                    : undefined
                            }
                        />
                    </div>
                    <div>
                        <label htmlFor="platform" className={labelClass}>
                            Platform
                        </label>
                        <select
                            id="platform"
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            required
                            className={`${inputClass} form-select ${!platform ? 'text-[var(--text-muted)]' : ''} ${error?.toLowerCase().includes('platform') ? 'border-red-500 focus:ring-red-500' : ''}`}
                            aria-invalid={
                                error?.toLowerCase().includes('platform')
                                    ? true
                                    : undefined
                            }
                        >
                            <option value="" disabled>
                                Select platform
                            </option>
                            {PLATFORMS.map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div
                        className="flex items-center gap-3"
                        role="group"
                        aria-label="Linked series"
                    >
                        <button
                            type="button"
                            role="switch"
                            aria-checked={linked}
                            onClick={() => setLinked((v) => !v)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface)] ${linked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${linked ? 'translate-x-5' : 'translate-x-0.5'}`}
                            />
                        </button>
                        <span className="text-sm text-[var(--text)]">
                            Link to each other
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label htmlFor="tone" className={labelClass}>
                                Tone
                            </label>
                            <select
                                id="tone"
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                                className={`${inputClass} form-select`}
                            >
                                {TONES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="length" className={labelClass}>
                                Length
                            </label>
                            <select
                                id="length"
                                value={length}
                                onChange={(e) => setLength(e.target.value)}
                                className={`${inputClass} form-select`}
                            >
                                {LENGTHS.map((l) => (
                                    <option key={l} value={l}>
                                        {l}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {platform === 'TikTok' && (
                        <div>
                            <label
                                htmlFor="tiktokDuration"
                                className={labelClass}
                            >
                                Script duration (sec)
                            </label>
                            <input
                                id="tiktokDuration"
                                type="number"
                                min={15}
                                max={180}
                                step={15}
                                value={
                                    tiktokScriptDurationSeconds === ''
                                        ? ''
                                        : tiktokScriptDurationSeconds
                                }
                                onChange={(e) =>
                                    setTiktokScriptDurationSeconds(
                                        e.target.value === ''
                                            ? ''
                                            : Number(e.target.value),
                                    )
                                }
                                className={inputClass}
                            />
                        </div>
                    )}

                    <div
                        className="flex items-center gap-3"
                        role="group"
                        aria-label="Generate images"
                    >
                        <button
                            type="button"
                            role="switch"
                            aria-checked={generateImages}
                            onClick={() => setGenerateImages((v) => !v)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface)] ${generateImages ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${generateImages ? 'translate-x-5' : 'translate-x-0.5'}`}
                            />
                        </button>
                        <span className="text-sm text-[var(--text)]">
                            Generate images (when supported)
                        </span>
                    </div>

                    <fieldset className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                        <legend className="text-sm font-medium text-[var(--text)] px-1">
                            Schedule
                        </legend>
                        <div>
                            <label
                                htmlFor="startDate"
                                className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                            >
                                Start date{' '}
                                <span className="text-red-600">*</span>
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                    className={`${inputClass} flex-1 min-w-0 ${error?.toLowerCase().includes('date') ? 'border-red-500 focus:ring-red-500' : ''}`}
                                    aria-invalid={
                                        error?.toLowerCase().includes('date')
                                            ? true
                                            : undefined
                                    }
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setStartDate(
                                            new Date()
                                                .toISOString()
                                                .slice(0, 10),
                                        )
                                    }
                                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:opacity-90"
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date();
                                        d.setDate(d.getDate() + 1);
                                        setStartDate(d.toISOString().slice(0, 10));
                                    }}
                                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:opacity-90"
                                >
                                    Tomorrow
                                </button>
                            </div>
                        </div>
                        <div>
                            <label
                                htmlFor="time"
                                className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                            >
                                Time of day{' '}
                                <span className="text-red-600">*</span>
                            </label>
                            <input
                                id="time"
                                type="time"
                                value={scheduledTimeOfDay}
                                onChange={(e) =>
                                    setScheduledTimeOfDay(e.target.value)
                                }
                                required
                                className={`${inputClass} ${error?.toLowerCase().includes('time') ? 'border-red-500 focus:ring-red-500' : ''}`}
                                aria-invalid={
                                    error?.toLowerCase().includes('time')
                                        ? true
                                        : undefined
                                }
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="recurrence"
                                className="block text-xs font-medium text-[var(--text-muted)] mb-1"
                            >
                                Recurrence
                            </label>
                            <select
                                id="recurrence"
                                value={recurrence}
                                onChange={(e) => setRecurrence(e.target.value)}
                                className={`${inputClass} form-select`}
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>
                    </fieldset>
                </div>
            </aside>

            {/* Main: topic + voice + generate */}
            <div className="flex-1 flex flex-col px-8 py-8 max-w-2xl mx-auto w-full">
                <h1 className="text-2xl font-bold text-[var(--text)]">
                    Generate posts
                </h1>
                <p className="mt-1 text-[var(--text-muted)]">
                    Describe your topic. Generated posts will appear in your
                    list.
                </p>

                <form
                    onSubmit={handleSubmit}
                    className="mt-8 flex flex-col flex-1"
                >
                    <div className="flex-1">
                        <label htmlFor="topic" className={labelClass}>
                            Topic (describe in detail){' '}
                            <span className="text-red-600">*</span>
                        </label>
                        <textarea
                            id="topic"
                            required
                            value={liveTranscript ? `${topicDetail}${topicDetail ? ' ' : ''}${liveTranscript}` : topicDetail}
                            onChange={(e) =>
                                liveTranscript === ''
                                    ? setTopicDetail(e.target.value)
                                    : undefined
                            }
                            readOnly={liveTranscript !== ''}
                            rows={6}
                            className={`mt-1.5 w-full ${inputClass} resize-y min-h-[120px] ${error?.toLowerCase().includes('topic') ? 'border-red-500 focus:ring-red-500' : ''}`}
                            placeholder="e.g. How to build a habit of daily writing in 30 days…"
                            aria-invalid={
                                error?.toLowerCase().includes('topic')
                                    ? true
                                    : undefined
                            }
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <VoiceInput
                                onResult={appendTopicWithVoice}
                                onInterimResult={setVoiceInterim}
                                iconOnly
                                className="shrink-0 flex items-center justify-center w-11 h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={submitting}
                                className={btnPrimary}
                            >
                                {submitting ? 'Generating…' : 'Generate series'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="mt-4 text-red-600 text-sm" role="alert">
                            {error}
                        </p>
                    )}
                </form>
            </div>
        </main>
    );
}