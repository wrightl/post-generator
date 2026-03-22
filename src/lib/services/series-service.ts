import { db } from "@/db/drizzle";
import { posts, postSeries } from "@/db/schema";
import type { PostPlatform } from "@/db/schema";
import {
  generatePosts,
  generateSinglePost,
  type GeneratePostOptions,
  type GeneratedPostItem,
} from "./post-generation-service";
import type { PostDto } from "./post-service";

const PLATFORMS = [
  "LinkedIn",
  "Skool",
  "Instagram",
  "Bluesky",
  "Facebook",
  "TikTok",
] as const;

function isValidPlatform(s: string): s is PostPlatform {
  return PLATFORMS.includes(s as PostPlatform);
}

export interface GenerateSeriesRequest {
  topicDetail: string;
  numPosts: number;
  platform: string;
  linked?: boolean;
  tone?: string | null;
  length?: string | null;
  generateImages?: boolean;
  tiktokScriptDurationSeconds?: number | null;
  startDate?: Date | null;
  recurrence?: string | null;
  scheduledTimeOfDay?: string | null;
}

export interface PublishGeneratedRequest {
  topicDetail: string;
  numPosts: number;
  platform: string;
  generatedPosts: {
    content: string;
    script?: string | null;
    metadataJson?: string | null;
    imageUrl?: string | null;
  }[];
  linked?: boolean;
  tone?: string | null;
  length?: string | null;
  generateImages?: boolean;
  tiktokScriptDurationSeconds?: number | null;
  startDate?: Date | null;
  recurrence?: string | null;
  scheduledTimeOfDay?: string | null;
}

function parseTimeOfDay(s: string | null | undefined): number | null {
  if (!s) return null;
  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export async function generate(
  userId: number,
  req: GenerateSeriesRequest
): Promise<{ seriesId: number; postIds: number[] } | null> {
  if (!isValidPlatform(req.platform)) return null;

  const options: GeneratePostOptions = {
    topicDetail: req.topicDetail,
    numPosts: req.numPosts,
    platform: req.platform,
    linked: req.linked ?? false,
    tone: req.tone,
    length: req.length,
    tiktokScriptDurationSeconds: req.tiktokScriptDurationSeconds ?? null,
  };

  const generated = await generatePosts(options);
  if (generated.length === 0) return null;

  const [series] = await db
    .insert(postSeries)
    .values({
      userId,
      topicDetail: req.topicDetail,
      numPosts: generated.length,
      optionsJson: JSON.stringify({
        linked: req.linked,
        tone: req.tone,
        length: req.length,
        generateImages: req.generateImages,
        startDate: req.startDate,
        recurrence: req.recurrence,
        scheduledTimeOfDay: req.scheduledTimeOfDay,
      }),
    })
    .returning();

  if (!series) return null;

  const startDate = req.startDate ? new Date(req.startDate) : new Date();
  const timeMins = parseTimeOfDay(req.scheduledTimeOfDay);
  const recurrence = req.recurrence === "daily" ? 1 : 7;

  const postRows = [];
  for (let i = 0; i < generated.length; i++) {
    const g = generated[i];
    let scheduledAt: Date | null = null;
    if (req.startDate && timeMins != null) {
      const d = new Date(startDate);
      d.setHours(Math.floor(timeMins / 60), timeMins % 60, 0, 0);
      d.setDate(d.getDate() + i * recurrence);
      scheduledAt = d;
    }

    postRows.push({
      userId,
      topicSummary:
        req.topicDetail.length > 500
          ? req.topicDetail.slice(0, 500)
          : req.topicDetail,
      platform: req.platform as PostPlatform,
      status: scheduledAt ? ("Scheduled" as const) : ("Draft" as const),
      scheduledAt,
      content: g.content,
      script: g.script,
      metadataJson: g.hashtagsJson
        ? JSON.stringify({ hashtags: JSON.parse(g.hashtagsJson) })
        : null,
      tone: req.tone,
      length: req.length,
    });
  }

  const inserted = await db.insert(posts).values(postRows).returning();
  return {
    seriesId: series.id,
    postIds: inserted.map((p) => p.id),
  };
}

export async function generateStream(
  userId: number,
  req: GenerateSeriesRequest,
  onPost: (seriesId: number, post: PostDto) => Promise<void>
): Promise<void> {
  if (!isValidPlatform(req.platform)) {
    throw new Error("Invalid platform");
  }

  const [series] = await db
    .insert(postSeries)
    .values({
      userId,
      topicDetail: req.topicDetail,
      numPosts: req.numPosts,
      optionsJson: JSON.stringify({
        linked: req.linked,
        tone: req.tone,
        length: req.length,
        generateImages: req.generateImages,
        startDate: req.startDate,
        recurrence: req.recurrence,
        scheduledTimeOfDay: req.scheduledTimeOfDay,
      }),
    })
    .returning();

  if (!series) throw new Error("Failed to create series");

  const options: GeneratePostOptions = {
    topicDetail: req.topicDetail,
    numPosts: req.numPosts,
    platform: req.platform,
    linked: req.linked ?? false,
    tone: req.tone,
    length: req.length,
    tiktokScriptDurationSeconds: req.tiktokScriptDurationSeconds ?? null,
  };

  const startDate = req.startDate ? new Date(req.startDate) : new Date();
  const timeMins = parseTimeOfDay(req.scheduledTimeOfDay);
  const recurrence = req.recurrence === "daily" ? 1 : 7;
  const topicSummary =
    req.topicDetail.length > 500 ? req.topicDetail.slice(0, 500) : req.topicDetail;
  const previousContents: string[] = [];

  for (let i = 0; i < req.numPosts; i++) {
    const generated = await generateSinglePost(options, i + 1, previousContents);

    let scheduledAt: Date | null = null;
    if (req.startDate && timeMins != null) {
      const d = new Date(startDate);
      d.setHours(Math.floor(timeMins / 60), timeMins % 60, 0, 0);
      d.setDate(d.getDate() + i * recurrence);
      scheduledAt = d;
    }

    const status = scheduledAt ? "Scheduled" : "Draft";
    const now = new Date();
    const metadataJson = generated.hashtagsJson
      ? JSON.stringify({ hashtags: JSON.parse(generated.hashtagsJson) })
      : null;

    const postDto: PostDto = {
      id: 0,
      userId,
      topicSummary,
      platform: req.platform,
      status,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      publishedAt: null,
      externalPostId: null,
      viewsCount: null,
      likesCount: null,
      commentsCount: null,
      lastEngagementFetchedAt: null,
      content: generated.content,
      script: generated.script ?? null,
      imageUrl: null,
      metadataJson,
      tone: req.tone ?? null,
      length: req.length ?? null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await onPost(series.id, postDto);
    previousContents.push(generated.content);
  }
}

export async function publishGenerated(
  userId: number,
  req: PublishGeneratedRequest
): Promise<{ seriesId: number; postIds: number[] }> {
  if (!isValidPlatform(req.platform)) {
    throw new Error("Invalid platform");
  }

  const [series] = await db
    .insert(postSeries)
    .values({
      userId,
      topicDetail: req.topicDetail,
      numPosts: req.generatedPosts.length,
      optionsJson: JSON.stringify({
        linked: req.linked,
        tone: req.tone,
        length: req.length,
        generateImages: req.generateImages,
        startDate: req.startDate,
        recurrence: req.recurrence,
        scheduledTimeOfDay: req.scheduledTimeOfDay,
      }),
    })
    .returning();

  if (!series) throw new Error("Failed to create series");

  const startDate = req.startDate ? new Date(req.startDate) : new Date();
  const timeMins = parseTimeOfDay(req.scheduledTimeOfDay);
  const recurrence = req.recurrence === "daily" ? 1 : 7;
  const topicSummary =
    req.topicDetail.length > 500 ? req.topicDetail.slice(0, 500) : req.topicDetail;

  const postRows = req.generatedPosts.map((item, i) => {
    let scheduledAt: Date | null = null;
    if (req.startDate && timeMins != null) {
      const d = new Date(startDate);
      d.setHours(Math.floor(timeMins / 60), timeMins % 60, 0, 0);
      d.setDate(d.getDate() + i * recurrence);
      scheduledAt = d;
    }
    return {
      userId,
      topicSummary,
      platform: req.platform as PostPlatform,
      status: scheduledAt ? ("Scheduled" as const) : ("Draft" as const),
      scheduledAt,
      content: item.content,
      script: item.script ?? null,
      imageUrl: item.imageUrl ?? null,
      metadataJson: item.metadataJson ?? null,
      tone: req.tone ?? null,
      length: req.length ?? null,
    };
  });

  const inserted = await db.insert(posts).values(postRows).returning();
  return {
    seriesId: series.id,
    postIds: inserted.map((p) => p.id),
  };
}
