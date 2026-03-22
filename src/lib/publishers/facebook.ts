import type { PostToPublish, PublishResult } from "./types";

export async function publish(
  post: PostToPublish,
  credentials: Record<string, string> | null
): Promise<PublishResult> {
  const pageId = credentials?.PageId ?? process.env.FACEBOOK_PAGE_ID;
  const pageAccessToken =
    credentials?.PageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !pageAccessToken) return { success: false };

  try {
    let url: string;
    if (post.imageUrl) {
      url = `https://graph.facebook.com/v21.0/${pageId}/photos?url=${encodeURIComponent(post.imageUrl)}&message=${encodeURIComponent(post.content)}&access_token=${encodeURIComponent(pageAccessToken)}`;
    } else {
      url = `https://graph.facebook.com/v21.0/${pageId}/feed?message=${encodeURIComponent(post.content)}&access_token=${encodeURIComponent(pageAccessToken)}`;
    }

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) return { success: false };

    const body = (await res.json()) as { id?: string };
    return { success: true, externalPostId: body.id };
  } catch {
    return { success: false };
  }
}
