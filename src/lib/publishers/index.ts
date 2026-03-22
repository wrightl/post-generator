import type { PostPlatform, PostToPublish, PublishResult } from "./types";
import * as linkedin from "./linkedin";
import * as bluesky from "./bluesky";
import * as facebook from "./facebook";
import * as instagram from "./instagram";
import * as skool from "./skool";
import * as tiktok from "./tiktok";

const PUBLISHERS: Record<PostPlatform, (post: PostToPublish, creds: Record<string, string> | null) => Promise<PublishResult>> = {
  LinkedIn: linkedin.publish,
  Bluesky: bluesky.publish,
  Facebook: facebook.publish,
  Instagram: instagram.publish,
  Skool: skool.publish,
  TikTok: tiktok.publish,
};

export async function publishToPlatform(
  post: PostToPublish,
  credentials: Record<string, string> | null
): Promise<PublishResult> {
  const fn = PUBLISHERS[post.platform];
  if (!fn) return { success: false };
  return fn(post, credentials);
}
