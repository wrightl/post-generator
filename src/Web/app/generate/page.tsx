"use client";

import { useAuth } from "@/contexts/AuthContext";
import type { GenerateSeriesPayload } from "@/lib/api";
import { VoiceInput } from "@/components/VoiceInput";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const PLATFORMS = ["LinkedIn", "Skool", "Instagram", "Bluesky", "Facebook", "TikTok"] as const;
const TONES = ["Professional", "Casual", "Friendly", "Authoritative", "Inspirational"];
const LENGTHS = ["Short", "Medium", "Long"];

const inputClass =
  "mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";
const labelClass = "block font-medium text-[var(--text)]";
const btnPrimary =
  "rounded px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50";
const btnSecondary =
  "rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--text)] hover:opacity-90";

export default function GeneratePage() {
  const { appUser, idToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const [topicDetail, setTopicDetail] = useState("");
  const [numPosts, setNumPosts] = useState(5);
  const [platform, setPlatform] = useState<string>("LinkedIn");
  const [linked, setLinked] = useState(false);
  const [tone, setTone] = useState("");
  const [length, setLength] = useState("");
  const [generateImages, setGenerateImages] = useState(false);
  const [tiktokScriptDurationSeconds, setTiktokScriptDurationSeconds] = useState<number | "">(60);
  const [startDate, setStartDate] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [scheduledTimeOfDay, setScheduledTimeOfDay] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appendVoiceToTopic = useCallback((text: string) => {
    setTopicDetail((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  const PENDING_PAYLOAD_KEY = "postGenerator.pendingSeriesPayload";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken || !topicDetail.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: GenerateSeriesPayload = {
        topicDetail: topicDetail.trim(),
        numPosts,
        platform,
        linked,
        tone: tone || undefined,
        length: length || undefined,
        generateImages,
        startDate: startDate || undefined,
        recurrence: recurrence || undefined,
        scheduledTimeOfDay: scheduledTimeOfDay || undefined,
      };
      if (platform === "TikTok" && typeof tiktokScriptDurationSeconds === "number")
        payload.tiktokScriptDurationSeconds = tiktokScriptDurationSeconds;
      if (typeof sessionStorage !== "undefined")
        sessionStorage.setItem(PENDING_PAYLOAD_KEY, JSON.stringify(payload));
      router.push("/posts/generating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start generation");
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
        <p className="text-[var(--text)]">Please sign in to generate posts.</p>
        <Link href="/" className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
          Go home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-bold text-[var(--text)]">Generate posts</h1>
      <p className="mt-1 text-[var(--text-muted)]">
        Describe your topic and choose options. Generated posts will appear in your list.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="topic" className={labelClass}>Topic (describe in detail)</label>
          <div className="mt-1 flex gap-2">
            <textarea
              id="topic"
              required
              value={topicDetail}
              onChange={(e) => setTopicDetail(e.target.value)}
              rows={4}
              className={`flex-1 ${inputClass}`}
              placeholder="e.g. How to build a habit of daily writing in 30 days…"
            />
            <VoiceInput
              onResult={appendVoiceToTopic}
              className={`self-start rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:opacity-90`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="numPosts" className={labelClass}>Number of posts</label>
            <input
              id="numPosts"
              type="number"
              min={1}
              max={20}
              value={numPosts}
              onChange={(e) => setNumPosts(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="platform" className={labelClass}>Platform</label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={inputClass}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="linked"
            type="checkbox"
            checked={linked}
            onChange={(e) => setLinked(e.target.checked)}
            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--focus-ring)]"
          />
          <label htmlFor="linked" className="text-[var(--text)]">Linked (posts reference each other)</label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="tone" className={labelClass}>Tone</label>
            <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className={inputClass}>
              <option value="">Any</option>
              {TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="length" className={labelClass}>Length</label>
            <select id="length" value={length} onChange={(e) => setLength(e.target.value)} className={inputClass}>
              <option value="">Any</option>
              {LENGTHS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {platform === "TikTok" && (
          <div>
            <label htmlFor="tiktokDuration" className={labelClass}>Script duration (seconds)</label>
            <input
              id="tiktokDuration"
              type="number"
              min={15}
              max={180}
              value={tiktokScriptDurationSeconds === "" ? "" : tiktokScriptDurationSeconds}
              onChange={(e) => setTiktokScriptDurationSeconds(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputClass}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="generateImages"
            type="checkbox"
            checked={generateImages}
            onChange={(e) => setGenerateImages(e.target.checked)}
            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--focus-ring)]"
          />
          <label htmlFor="generateImages" className="text-[var(--text)]">Generate images (when supported)</label>
        </div>

        <fieldset className="rounded border border-[var(--border)] p-4">
          <legend className="font-medium text-[var(--text)]">Schedule</legend>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm text-[var(--text-muted)]">Start date</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="time" className="block text-sm text-[var(--text-muted)]">Time of day</label>
              <input
                id="time"
                type="time"
                value={scheduledTimeOfDay}
                onChange={(e) => setScheduledTimeOfDay(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="recurrence" className="block text-sm text-[var(--text-muted)]">Recurrence</label>
              <select
                id="recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
        </fieldset>

        {error && <p className="text-red-600" role="alert">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? "Generating…" : "Generate series"}
          </button>
          <Link href="/posts" className={btnSecondary}>
            Cancel
          </Link>
        </div>
      </form>

      <p className="mt-6">
        <Link href="/posts" className="text-[var(--primary)] underline hover:text-[var(--primary-hover)]">
          Back to posts
        </Link>
      </p>
    </main>
  );
}
