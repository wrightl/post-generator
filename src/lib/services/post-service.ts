import { db } from "@/db/drizzle";
import {
  posts,
  type Post,
  type PostPlatform,
  type PostStatus,
} from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import type { NewPost } from "@/db/schema";

const PLATFORMS: PostPlatform[] = [
  "LinkedIn",
  "Skool",
  "Instagram",
  "Bluesky",
  "Facebook",
  "TikTok",
];
const STATUSES: PostStatus[] = ["Draft", "Scheduled", "Published", "Failed"];

function isValidPlatform(s: string): s is PostPlatform {
  return PLATFORMS.includes(s as PostPlatform);
}
function isValidStatus(s: string): s is PostStatus {
  return STATUSES.includes(s as PostStatus);
}

export interface PostDto {
  id: number;
  userId: number;
  topicSummary: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  viewsCount: number | null;
  likesCount: number | null;
  commentsCount: number | null;
  lastEngagementFetchedAt: string | null;
  content: string;
  script: string | null;
  imageUrl: string | null;
  metadataJson: string | null;
  tone: string | null;
  length: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDto(p: Post): PostDto {
  return {
    id: p.id,
    userId: p.userId,
    topicSummary: p.topicSummary ?? "",
    platform: p.platform,
    status: p.status,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    externalPostId: p.externalPostId,
    viewsCount: p.viewsCount,
    likesCount: p.likesCount,
    commentsCount: p.commentsCount,
    lastEngagementFetchedAt: p.lastEngagementFetchedAt?.toISOString() ?? null,
    content: p.content,
    script: p.script,
    imageUrl: p.imageUrl,
    metadataJson: p.metadataJson,
    tone: p.tone,
    length: p.length,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export interface ListResult {
  items: PostDto[];
  totalCount: number;
}

export async function list(
  userId: number,
  opts: {
    platforms?: string[];
    statuses?: string[];
    from?: Date;
    to?: Date;
    skip?: number;
    take?: number;
  }
): Promise<ListResult> {
  const conditions = [eq(posts.userId, userId)];

  const platformSet = opts.platforms?.filter(isValidPlatform) ?? [];
  if (platformSet.length > 0) {
    conditions.push(inArray(posts.platform, platformSet));
  }

  const statusSet = opts.statuses?.filter(isValidStatus) ?? [];
  if (statusSet.length > 0) {
    conditions.push(inArray(posts.status, statusSet));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  let rows = await db
    .select()
    .from(posts)
    .where(whereClause)
    .orderBy(asc(posts.scheduledAt), asc(posts.createdAt));

  if (opts.from) {
    rows = rows.filter(
      (r) =>
        (r.scheduledAt && r.scheduledAt >= opts.from!) ||
        (!r.scheduledAt && r.createdAt >= opts.from!)
    );
  }
  if (opts.to) {
    rows = rows.filter((r) => !r.scheduledAt || r.scheduledAt <= opts.to!);
  }

  const totalCount = rows.length;
  const skip = opts.skip ?? 0;
  const take = opts.take ?? 20;
  const paged = rows.slice(skip, skip + take);

  return { items: paged.map(toDto), totalCount };
}

export async function getById(
  userId: number,
  postId: number
): Promise<PostDto | null> {
  const [p] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);
  return p ? toDto(p) : null;
}

export interface CreatePostRequest {
  topicSummary: string;
  platform: string;
  content?: string | null;
  script?: string | null;
  imageUrl?: string | null;
  metadataJson?: string | null;
  tone?: string | null;
  length?: string | null;
  scheduledAt?: Date | null;
}

export async function create(
  userId: number,
  req: CreatePostRequest
): Promise<PostDto> {
  if (!isValidPlatform(req.platform)) {
    throw new Error("Invalid platform");
  }

  const [inserted] = await db
    .insert(posts)
    .values({
      userId,
      topicSummary: req.topicSummary ?? "",
      platform: req.platform,
      status: "Draft",
      content: req.content ?? "",
      script: req.script,
      imageUrl: req.imageUrl,
      metadataJson: req.metadataJson,
      tone: req.tone,
      length: req.length,
      scheduledAt: req.scheduledAt ? new Date(req.scheduledAt) : null,
    } as NewPost)
    .returning();

  return toDto(inserted!);
}

export interface UpdatePostRequest {
  topicSummary?: string | null;
  content?: string | null;
  script?: string | null;
  imageUrl?: string | null;
  metadataJson?: string | null;
  tone?: string | null;
  length?: string | null;
  scheduledAt?: Date | null;
  status?: string | null;
}

export async function update(
  userId: number,
  postId: number,
  req: UpdatePostRequest
): Promise<PostDto | null> {
  const [existing] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const updates: Partial<Post> = { updatedAt: new Date() };
  if (req.topicSummary !== undefined) updates.topicSummary = req.topicSummary;
  if (req.content !== undefined && req.content != null) updates.content = req.content;
  if (req.script !== undefined) updates.script = req.script;
  if (req.imageUrl !== undefined) updates.imageUrl = req.imageUrl;
  if (req.metadataJson !== undefined) updates.metadataJson = req.metadataJson;
  if (req.tone !== undefined) updates.tone = req.tone;
  if (req.length !== undefined) updates.length = req.length;
  if (req.scheduledAt !== undefined)
    updates.scheduledAt = req.scheduledAt ? new Date(req.scheduledAt) : null;
  if (
    req.status !== undefined &&
    req.status !== null &&
    isValidStatus(req.status)
  )
    updates.status = req.status;

  const [updated] = await db
    .update(posts)
    .set(updates as Partial<Post>)
    .where(eq(posts.id, postId))
    .returning();

  return updated ? toDto(updated) : null;
}

export async function remove(
  userId: number,
  postId: number
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);
  if (!existing) return false;

  await db.delete(posts).where(eq(posts.id, postId));
  return true;
}

export async function setPostImageUrl(
  userId: number,
  postId: number,
  imageUrl: string | null
): Promise<PostDto | null> {
  const [existing] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const [updated] = await db
    .update(posts)
    .set({ imageUrl, updatedAt: new Date() })
    .where(eq(posts.id, postId))
    .returning();

  return updated ? toDto(updated) : null;
}

export async function publishNow(
  userId: number,
  postId: number
): Promise<PostDto | null> {
  const [existing] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);
  if (!existing || existing.status !== "Draft") return null;

  const now = new Date();
  const [updated] = await db
    .update(posts)
    .set({ status: "Published", publishedAt: now, updatedAt: now })
    .where(eq(posts.id, postId))
    .returning();

  return updated ? toDto(updated) : null;
}

export interface DashboardStats {
  totalPosts: number;
  draftCount: number;
  scheduledCount: number;
  publishedCount: number;
  failedCount: number;
  byPlatform: { platform: string; count: number }[];
  upcomingPosts: {
    id: number;
    platform: string;
    scheduledAt: string;
    topicSummary: string;
  }[];
  mostRecentPublished: PostDto | null;
}

const UPCOMING_TAKE = 10;

export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const all = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId));

  const totalPosts = all.length;
  const draftCount = all.filter((p) => p.status === "Draft").length;
  const scheduledCount = all.filter((p) => p.status === "Scheduled").length;
  const publishedCount = all.filter((p) => p.status === "Published").length;
  const failedCount = all.filter((p) => p.status === "Failed").length;

  const platformCounts = new Map<string, number>();
  for (const p of all) {
    platformCounts.set(p.platform, (platformCounts.get(p.platform) ?? 0) + 1);
  }
  const byPlatform = Array.from(platformCounts.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const upcoming = all
    .filter(
      (p) =>
        p.status === "Scheduled" &&
        p.scheduledAt &&
        p.scheduledAt >= now
    )
    .sort((a, b) => (a.scheduledAt!.getTime() - b.scheduledAt!.getTime()))
    .slice(0, UPCOMING_TAKE)
    .map((p) => ({
      id: p.id,
      platform: p.platform,
      scheduledAt: p.scheduledAt!.toISOString(),
      topicSummary: p.topicSummary ?? "",
    }));

  const mostRecentPublished = all
    .filter((p) => p.status === "Published" && p.publishedAt)
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime())[0];

  return {
    totalPosts,
    draftCount,
    scheduledCount,
    publishedCount,
    failedCount,
    byPlatform,
    upcomingPosts: upcoming,
    mostRecentPublished: mostRecentPublished
      ? toDto(mostRecentPublished)
      : null,
  };
}
