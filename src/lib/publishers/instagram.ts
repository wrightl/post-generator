import type { PostToPublish, PublishResult } from "./types";

export async function publish(
  post: PostToPublish,
  credentials: Record<string, string> | null
): Promise<PublishResult> {
  const userId = credentials?.UserId ?? process.env.INSTAGRAM_USER_ID;
  const accessToken =
    credentials?.AccessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!userId || !accessToken) return { success: false };

  try {
    const baseUrl = "https://graph.facebook.com/v21.0";
    let containerUrl: string;
    if (post.imageUrl) {
      containerUrl = `${baseUrl}/${userId}/media?image_url=${encodeURIComponent(post.imageUrl)}&caption=${encodeURIComponent(post.content)}`;
    } else {
      containerUrl = `${baseUrl}/${userId}/media?caption=${encodeURIComponent(post.content)}`;
    }

    const containerRes = await fetch(containerUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!containerRes.ok) return { success: false };

    const containerJson = (await containerRes.json()) as { id?: string };
    const creationId = containerJson.id;
    if (!creationId) return { success: false };

    const publishUrl = `${baseUrl}/${userId}/media_publish?creation_id=${encodeURIComponent(creationId)}`;
    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!publishRes.ok) return { success: false };

    const publishJson = (await publishRes.json()) as { id?: string };
    return { success: true, externalPostId: publishJson.id };
  } catch {
    return { success: false };
  }
}
