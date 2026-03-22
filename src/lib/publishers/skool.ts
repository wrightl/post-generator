import type { PostToPublish, PublishResult } from "./types";

export async function publish(
  _post: PostToPublish,
  _credentials: Record<string, string> | null
): Promise<PublishResult> {
  // Skool API integration - stub for now
  return { success: false };
}
