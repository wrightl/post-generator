const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:7049";

// --- User profile & credentials ---
export type UserProfile = {
  id: number;
  email: string;
  name: string | null;
  preferredTheme: string | null;
  createdAt: string;
};

export type SocialCredential = {
  platform: string;
  credentials: Record<string, string | null>;
};

export async function getProfile(idToken: string): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/api/users/me/profile`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function updateProfile(
  idToken: string,
  payload: { preferredTheme?: string | null }
): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/me/profile`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ preferredTheme: payload.preferredTheme ?? null }),
  });
  if (!res.ok) throw new Error("Failed to update profile");
}

export async function getCredentials(idToken: string): Promise<SocialCredential[]> {
  const res = await fetch(`${API_URL}/api/users/me/credentials`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch credentials");
  return res.json();
}

export async function setCredential(
  idToken: string,
  platform: string,
  credentials: Record<string, string | null>
): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/me/credentials/${encodeURIComponent(platform)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credentials }),
  });
  if (!res.ok) throw new Error("Failed to save credentials");
}

export type Post = {
  id: number;
  userId: number;
  topicSummary: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  content: string;
  script: string | null;
  imageUrl: string | null;
  metadataJson: string | null;
  tone: string | null;
  length: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchPosts(
  idToken: string,
  opts?: { platform?: string; status?: string }
): Promise<Post[]> {
  const params = new URLSearchParams();
  if (opts?.platform) params.set("platform", opts.platform);
  if (opts?.status) params.set("status", opts.status);
  const url = `${API_URL}/api/posts${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

export async function getPost(idToken: string, postId: number): Promise<Post> {
  const res = await fetch(`${API_URL}/api/posts/${postId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch post");
  return res.json();
}

export async function createPost(
  idToken: string,
  payload: {
    topicSummary: string;
    platform: string;
    content?: string | null;
    script?: string | null;
    imageUrl?: string | null;
    metadataJson?: string | null;
    tone?: string | null;
    length?: string | null;
    scheduledAt?: string | null;
  }
): Promise<Post> {
  const res = await fetch(`${API_URL}/api/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to create post");
  }
  return res.json();
}

export async function updatePost(
  idToken: string,
  postId: number,
  payload: {
    topicSummary?: string | null;
    content?: string | null;
    script?: string | null;
    imageUrl?: string | null;
    metadataJson?: string | null;
    tone?: string | null;
    length?: string | null;
    scheduledAt?: string | null;
    status?: string | null;
  }
): Promise<Post> {
  const res = await fetch(`${API_URL}/api/posts/${postId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to update post");
  }
  return res.json();
}

export async function deletePost(idToken: string, postId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error("Failed to delete post");
}

export async function generatePostImage(
  idToken: string,
  postId: number,
  prompt?: string
): Promise<Post> {
  const res = await fetch(`${API_URL}/api/posts/${postId}/generate-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: prompt ?? null }),
  });
  if (!res.ok) throw new Error("Failed to generate image");
  return res.json();
}

export type GenerateSeriesPayload = {
  topicDetail: string;
  numPosts: number;
  platform: string;
  linked?: boolean;
  tone?: string;
  length?: string;
  generateImages?: boolean;
  tiktokScriptDurationSeconds?: number;
  startDate?: string;
  recurrence?: string;
  scheduledTimeOfDay?: string;
};

export async function generateSeries(
  idToken: string,
  payload: GenerateSeriesPayload
): Promise<{ seriesId: number; postIds: number[] }> {
  const res = await fetch(`${API_URL}/api/series/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicDetail: payload.topicDetail,
      numPosts: payload.numPosts,
      platform: payload.platform,
      linked: payload.linked ?? false,
      tone: payload.tone ?? null,
      length: payload.length ?? null,
      generateImages: payload.generateImages ?? false,
      tiktokScriptDurationSeconds: payload.tiktokScriptDurationSeconds ?? null,
      startDate: payload.startDate ?? null,
      recurrence: payload.recurrence ?? null,
      scheduledTimeOfDay: payload.scheduledTimeOfDay ?? null,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to generate series");
  }
  return res.json();
}
