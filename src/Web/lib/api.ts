export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost:7049';

// --- User profile & credentials ---
export type UserProfile = {
    id: number;
    email: string;
    name: string | null;
    preferredTheme: string | null;
    avatarUrl: string | null;
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
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
}

export async function updateProfile(
    idToken: string,
    payload: { preferredTheme?: string | null; avatarUrl?: string | null },
): Promise<void> {
    const res = await fetch(`${API_URL}/api/users/me/profile`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            preferredTheme: payload.preferredTheme ?? null,
            avatarUrl: payload.avatarUrl ?? null,
        }),
    });
    if (!res.ok) throw new Error('Failed to update profile');
}

export async function getCredentials(
    idToken: string,
): Promise<SocialCredential[]> {
    const res = await fetch(`${API_URL}/api/users/me/credentials`, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch credentials');
    return res.json();
}

export async function setCredential(
    idToken: string,
    platform: string,
    credentials: Record<string, string | null>,
): Promise<void> {
    const res = await fetch(
        `${API_URL}/api/users/me/credentials/${encodeURIComponent(platform)}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${idToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credentials }),
        },
    );
    if (!res.ok) throw new Error('Failed to save credentials');
}

// --- Dashboard ---
export type DashboardStats = {
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
    mostRecentPublished: Post | null;
};

export async function getDashboardStats(
    idToken: string,
): Promise<DashboardStats> {
    const res = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
}

export type Post = {
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
};

export type FetchPostsOptions = {
    platforms?: string[];
    statuses?: string[];
    page?: number;
    pageSize?: number;
};

export type FetchPostsResult = {
    items: Post[];
    totalCount: number;
};

export async function fetchPosts(
    idToken: string,
    opts?: FetchPostsOptions,
): Promise<FetchPostsResult> {
    const params = new URLSearchParams();
    opts?.platforms?.forEach((p) => params.append('platform', p));
    opts?.statuses?.forEach((s) => params.append('status', s));
    if (opts?.page != null) params.set('page', String(opts.page));
    if (opts?.pageSize != null) params.set('pageSize', String(opts.pageSize));
    const url = `${API_URL}/api/posts${params.toString() ? `?${params}` : ''}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return res.json();
}

export async function getPost(idToken: string, postId: number): Promise<Post> {
    const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch post');
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
    },
): Promise<Post> {
    const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to create post');
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
    },
): Promise<Post> {
    const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to update post');
    }
    return res.json();
}

export async function deletePost(
    idToken: string,
    postId: number,
): Promise<void> {
    const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error('Failed to delete post');
}

export async function generatePostImage(
    idToken: string,
    postId: number,
    prompt?: string,
): Promise<Post> {
    const res = await fetch(`${API_URL}/api/posts/${postId}/generate-image`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt ?? null }),
    });
    const text = await res.text();
    if (!res.ok) {
        let message = 'Failed to generate image';
        try {
            const body = JSON.parse(text) as { message?: string };
            if (body?.message) message = body.message;
        } catch {
            if (text) message = text;
        }
        throw new Error(message);
    }
    return JSON.parse(text) as Post;
}

export async function publishPostNow(
    idToken: string,
    postId: number,
): Promise<Post> {
    const res = await fetch(`${API_URL}/api/posts/${postId}/publish-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to publish post');
    }
    return res.json();
}

export async function refreshPostEngagement(
    idToken: string,
    postId: number,
): Promise<Post> {
    const res = await fetch(
        `${API_URL}/api/posts/${postId}/refresh-engagement`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
        },
    );
    if (!res.ok) throw new Error('Failed to refresh engagement');
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

function seriesPayloadToBody(payload: GenerateSeriesPayload) {
    return {
        topicDetail: payload.topicDetail,
        numPosts: payload.numPosts,
        platform: payload.platform,
        linked: payload.linked ?? false,
        tone: payload.tone ?? null,
        length: payload.length ?? null,
        generateImages: payload.generateImages ?? false,
        tiktokScriptDurationSeconds:
            payload.tiktokScriptDurationSeconds ?? null,
        startDate: payload.startDate ?? null,
        recurrence: payload.recurrence ?? null,
        scheduledTimeOfDay: payload.scheduledTimeOfDay ?? null,
    };
}

export async function generateSeries(
    idToken: string,
    payload: GenerateSeriesPayload,
): Promise<{ seriesId: number; postIds: number[] }> {
    const res = await fetch(`${API_URL}/api/series/generate`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(seriesPayloadToBody(payload)),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to generate series');
    }
    return res.json();
}

export type GenerateSeriesStreamEvent =
    | { seriesId: number }
    | { post: Post }
    | { error: string };

export async function* generateSeriesStream(
    idToken: string,
    payload: GenerateSeriesPayload,
    signal?: AbortSignal,
): AsyncGenerator<GenerateSeriesStreamEvent> {
    const res = await fetch(`${API_URL}/api/series/generate-stream`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(seriesPayloadToBody(payload)),
        signal,
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to start series generation');
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const obj = JSON.parse(trimmed) as Record<string, unknown>;
                if (typeof obj.seriesId === 'number')
                    yield { seriesId: obj.seriesId };
                else if (obj.post != null && typeof obj.post === 'object')
                    yield { post: obj.post as Post };
                else if (typeof obj.error === 'string')
                    yield { error: obj.error };
            }
        }
        if (buffer.trim()) {
            const obj = JSON.parse(buffer.trim()) as Record<string, unknown>;
            if (typeof obj.seriesId === 'number')
                yield { seriesId: obj.seriesId };
            else if (obj.post != null && typeof obj.post === 'object')
                yield { post: obj.post as Post };
            else if (typeof obj.error === 'string') yield { error: obj.error };
        }
    } finally {
        reader.releaseLock();
    }
}

export type GeneratedPostItem = {
    content: string;
    script?: string | null;
    metadataJson?: string | null;
    imageUrl?: string | null;
};

export type PublishGeneratedSeriesRequest = {
    topicDetail: string;
    numPosts: number;
    platform: string;
    generatedPosts: GeneratedPostItem[];
    linked?: boolean;
    tone?: string;
    length?: string;
    generateImages?: boolean;
    tiktokScriptDurationSeconds?: number;
    startDate?: string | null;
    recurrence?: string | null;
    scheduledTimeOfDay?: string | null;
};

function publishGeneratedSeriesToBody(
    request: PublishGeneratedSeriesRequest,
): Record<string, unknown> {
    return {
        topicDetail: request.topicDetail,
        numPosts: request.numPosts,
        platform: request.platform,
        generatedPosts: request.generatedPosts.map((p) => ({
            content: p.content,
            script: p.script ?? null,
            metadataJson: p.metadataJson ?? null,
            imageUrl: p.imageUrl ?? null,
        })),
        linked: request.linked ?? false,
        tone: request.tone ?? null,
        length: request.length ?? null,
        generateImages: request.generateImages ?? false,
        tiktokScriptDurationSeconds:
            request.tiktokScriptDurationSeconds ?? null,
        startDate: request.startDate ?? null,
        recurrence: request.recurrence ?? null,
        scheduledTimeOfDay: request.scheduledTimeOfDay ?? null,
    };
}

export async function publishGeneratedSeries(
    idToken: string,
    request: PublishGeneratedSeriesRequest,
): Promise<{ seriesId: number; postIds: number[] }> {
    const res = await fetch(`${API_URL}/api/series/publish-generated`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(publishGeneratedSeriesToBody(request)),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to publish series');
    }
    return res.json();
}
