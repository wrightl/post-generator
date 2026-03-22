import type { PostToPublish, PublishResult } from "./types";

export async function publish(
  post: PostToPublish,
  credentials: Record<string, string> | null
): Promise<PublishResult> {
  const pdsUrl =
    (credentials?.PdsUrl ?? process.env.BLUESKY_PDS_URL ?? "https://bsky.social").replace(
      /\/$/,
      ""
    );
  const handle = credentials?.Handle ?? process.env.BLUESKY_HANDLE;
  const appPassword = credentials?.AppPassword ?? process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !appPassword) return { success: false };

  try {
    const sessionRes = await fetch(
      `${pdsUrl}/xrpc/com.atproto.server.createSession`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: handle, password: appPassword }),
      }
    );
    if (!sessionRes.ok) return { success: false };

    const session = (await sessionRes.json()) as { accessJwt?: string; did?: string };
    const accessJwt = session.accessJwt;
    const did = session.did;
    if (!accessJwt || !did) return { success: false };

    const createdAt = new Date().toISOString();
    const recordRes = await fetch(
      `${pdsUrl}/xrpc/com.atproto.repo.createRecord`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: did,
          collection: "app.bsky.feed.post",
          record: { text: post.content, createdAt },
        }),
      }
    );

    if (!recordRes.ok) return { success: false };

    const recordBody = (await recordRes.json()) as { uri?: string };
    return { success: true, externalPostId: recordBody.uri };
  } catch {
    return { success: false };
  }
}
