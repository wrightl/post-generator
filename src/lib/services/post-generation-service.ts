import { complete } from "./chat-completion";

export interface GeneratePostOptions {
  topicDetail: string;
  numPosts: number;
  platform: string;
  linked: boolean;
  tone?: string | null;
  length?: string | null;
  tiktokScriptDurationSeconds?: number | null;
}

export interface GeneratedPostItem {
  content: string;
  script?: string | null;
  hashtagsJson?: string | null;
}

function parsePostItems(content: string): GeneratedPostItem[] {
  try {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((item: Record<string, unknown>) => {
      const content = typeof item.content === "string" ? item.content : "";
      const script =
        typeof item.script === "string" ? item.script : null;
      let hashtagsJson: string | null = null;
      if (Array.isArray(item.hashtags)) {
        hashtagsJson = JSON.stringify(item.hashtags);
      }
      return { content, script, hashtagsJson };
    });
  } catch {
    return [{ content, script: null, hashtagsJson: null }];
  }
}

function parseSinglePostItem(content: string): GeneratedPostItem {
  try {
    const item = JSON.parse(content) as Record<string, unknown>;
    const c = typeof item.content === "string" ? item.content : content;
    const script = typeof item.script === "string" ? item.script : null;
    let hashtagsJson: string | null = null;
    if (Array.isArray(item.hashtags)) {
      hashtagsJson = JSON.stringify(item.hashtags);
    }
    return { content: c, script, hashtagsJson };
  } catch {
    return { content, script: null, hashtagsJson: null };
  }
}

export async function generatePosts(
  options: GeneratePostOptions
): Promise<GeneratedPostItem[]> {
  const platformNote =
    options.platform.toLowerCase() === "tiktok" && options.tiktokScriptDurationSeconds
      ? ` Each post must include a script suitable for a ${options.tiktokScriptDurationSeconds} second video (approx ${options.tiktokScriptDurationSeconds * 2} words).`
      : "";

  const systemPrompt =
    "You are a social media content writer. Generate posts as JSON. For each post return exactly: \"content\" (the post text), \"script\" (only for TikTok, the video script), \"hashtags\" (JSON array of hashtag strings). Be concise and match the requested tone and length.";
  const userPrompt = `Generate ${options.numPosts} ${options.linked ? "linked" : "standalone"} posts for platform: ${options.platform}. Topic: ${options.topicDetail}. Tone: ${options.tone ?? "professional"}. Length: ${options.length ?? "medium"}.${platformNote} Return a JSON array of objects, each with "content", "script" (optional), "hashtags" (array of strings). No markdown, only the raw JSON array.`;

  const content = await complete(systemPrompt, userPrompt, 4000);
  if (!content) return [];

  return parsePostItems(content);
}

export async function generateSinglePost(
  options: GeneratePostOptions,
  index: number,
  previousContents: string[]
): Promise<GeneratedPostItem> {
  const platformNote =
    options.platform.toLowerCase() === "tiktok" && options.tiktokScriptDurationSeconds
      ? ` The post must include a script suitable for a ${options.tiktokScriptDurationSeconds} second video (approx ${options.tiktokScriptDurationSeconds * 2} words).`
      : "";

  const linkedContext =
    options.linked && previousContents.length > 0
      ? ` Previous posts in this series (for continuity): ${previousContents.join(" | ")}. Write the next post that follows naturally.`
      : "";

  const systemPrompt =
    "You are a social media content writer. Generate a single post as JSON. Return exactly one object with: \"content\" (the post text), \"script\" (only for TikTok, the video script), \"hashtags\" (JSON array of hashtag strings). Be concise and match the requested tone and length. No markdown, only the raw JSON object.";
  const userPrompt = `Generate post ${index} of ${options.numPosts} for platform: ${options.platform}. Topic: ${options.topicDetail}. Tone: ${options.tone ?? "professional"}. Length: ${options.length ?? "medium"}.${platformNote}${linkedContext} Return a single JSON object with "content", "script" (optional), "hashtags" (array of strings).`;

  const content = await complete(systemPrompt, userPrompt, 2000);
  if (!content) throw new Error("Post generation returned empty");

  return parseSinglePostItem(content);
}
