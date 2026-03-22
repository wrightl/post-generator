import { db } from "@/db/drizzle";
import { posts, userSocialCredentials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { PostDto } from "./post-service";

function toDto(p: {
  id: number;
  userId: number;
  topicSummary: string | null;
  platform: string;
  status: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  externalPostId: string | null;
  viewsCount: number | null;
  likesCount: number | null;
  commentsCount: number | null;
  lastEngagementFetchedAt: Date | null;
  content: string;
  script: string | null;
  imageUrl: string | null;
  metadataJson: string | null;
  tone: string | null;
  length: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PostDto {
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

export async function refreshEngagement(
  userId: number,
  postId: number
): Promise<PostDto | null> {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .limit(1);

  if (!post || !post.externalPostId) return null;

  const [credRow] = await db
    .select()
    .from(userSocialCredentials)
    .where(
      and(
        eq(userSocialCredentials.userId, userId),
        eq(userSocialCredentials.platform, post.platform)
      )
    )
    .limit(1);

  if (!credRow?.credentialJson) return null;

  let credentials: Record<string, string>;
  try {
    credentials = JSON.parse(credRow.credentialJson) as Record<string, string>;
  } catch {
    return null;
  }
  if (Object.keys(credentials).length === 0) return null;

  let views: number | null = null;
  let likes: number | null = null;
  let comments: number | null = null;

  try {
    if (post.platform === "Facebook") {
      const r = await fetchFacebookEngagement(post.externalPostId, credentials);
      views = r.views;
      likes = r.likes;
      comments = r.comments;
    } else if (post.platform === "Instagram") {
      const r = await fetchInstagramEngagement(post.externalPostId, credentials);
      views = r.views;
      likes = r.likes;
    } else if (post.platform === "Bluesky") {
      likes = await fetchBlueskyEngagement(userId, post.externalPostId, credentials);
    }
  } catch {
    return null;
  }

  const now = new Date();
  await db
    .update(posts)
    .set({
      viewsCount: views ?? post.viewsCount,
      likesCount: likes ?? post.likesCount,
      commentsCount: comments ?? post.commentsCount,
      lastEngagementFetchedAt: now,
      updatedAt: now,
    })
    .where(eq(posts.id, postId));

  const [updated] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  return updated ? toDto(updated) : null;
}

async function fetchFacebookEngagement(
  postId: string,
  credentials: Record<string, string>
): Promise<{ views: number | null; likes: number | null; comments: number | null }> {
  const token = credentials.PageAccessToken;
  if (!token) return { views: null, likes: null, comments: null };

  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}?fields=likes.summary(true),comments.summary(true)&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Facebook API ${res.status}`);

  const doc = (await res.json()) as Record<string, unknown>;
  const likesEl = (doc.likes as Record<string, unknown>)?.summary as Record<string, unknown> | undefined;
  const commentsEl = (doc.comments as Record<string, unknown>)?.summary as Record<string, unknown> | undefined;
  const likes = typeof likesEl?.total_count === "number" ? likesEl.total_count : null;
  const comments = typeof commentsEl?.total_count === "number" ? commentsEl.total_count : null;

  const insightsUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}/insights?metric=post_impressions&access_token=${encodeURIComponent(token)}`;
  const insightsRes = await fetch(insightsUrl);
  let views: number | null = null;
  if (insightsRes.ok) {
    const insights = (await insightsRes.json()) as Record<string, unknown>;
    const data = insights.data as Array<{ values?: Array<{ value?: number }> }> | undefined;
    if (data?.[0]?.values?.[0]?.value != null) {
      views = data[0].values[0].value;
    }
  }

  return { views, likes, comments };
}

async function fetchInstagramEngagement(
  mediaId: string,
  credentials: Record<string, string>
): Promise<{ views: number | null; likes: number | null }> {
  const token = credentials.AccessToken;
  if (!token) return { views: null, likes: null };

  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}/insights?metric=engagement,impressions,reach`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Instagram API ${res.status}`);

  const doc = (await res.json()) as { data?: Array<{ name?: string; values?: Array<{ value?: number }> }> };
  let views: number | null = null;
  let likes: number | null = null;
  for (const item of doc.data ?? []) {
    const value = item.values?.[0]?.value ?? 0;
    if (item.name === "impressions") views = value;
    else if (item.name === "engagement") likes = value;
    else if (item.name === "reach" && views == null) views = value;
  }
  return { views, likes };
}

const blueskyCache = new Map<string, { jwt: string; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchBlueskyEngagement(
  userId: number,
  postUri: string,
  credentials: Record<string, string>
): Promise<number | null> {
  const handle = credentials.Handle;
  const appPassword = credentials.AppPassword;
  const pdsUrl = (credentials.PdsUrl ?? "https://bsky.social").replace(/\/$/, "");

  if (!handle || !appPassword) return null;

  const cacheKey = `${userId}:Bluesky`;
  let entry = blueskyCache.get(cacheKey);
  if (!entry || entry.expires < Date.now()) {
    const sessionRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    });
    if (!sessionRes.ok) throw new Error(`Bluesky session ${sessionRes.status}`);

    const session = (await sessionRes.json()) as { accessJwt?: string };
    const jwt = session.accessJwt;
    if (!jwt) return null;

    entry = { jwt, expires: Date.now() + CACHE_TTL_MS };
    blueskyCache.set(cacheKey, entry);
  }

  let likeCount = 0;
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    let url = `${pdsUrl}/xrpc/app.bsky.feed.getLikes?uri=${encodeURIComponent(postUri)}&limit=100`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

    const likesRes = await fetch(url, {
      headers: { Authorization: `Bearer ${entry.jwt}` },
    });
    if (!likesRes.ok) throw new Error(`Bluesky likes ${likesRes.status}`);

    const likesJson = (await likesRes.json()) as { likes?: unknown[]; cursor?: string };
    if (Array.isArray(likesJson.likes)) likeCount += likesJson.likes.length;
    cursor = likesJson.cursor;
    if (!cursor) break;
  }

  return likeCount;
}
