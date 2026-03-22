import type { PostToPublish, PublishResult } from "./types";

export async function publish(
  post: PostToPublish,
  credentials: Record<string, string> | null
): Promise<PublishResult> {
  const accessToken = credentials?.AccessToken ?? process.env.LINKEDIN_ACCESS_TOKEN;
  let personUrn = credentials?.PersonUrn ?? process.env.LINKEDIN_PERSON_URN;

  if (!accessToken) return { success: false };

  try {
    if (!personUrn) {
      const meRes = await fetch("https://api.linkedin.com/v2/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });
      if (!meRes.ok) return { success: false };
      const me = (await meRes.json()) as { id?: string };
      personUrn = me.id ?? undefined;
      if (!personUrn) return { success: false };
    }

    let mediaUrn: string | null = null;
    if (post.imageUrl) {
      mediaUrn = await uploadImage(accessToken, personUrn, post.imageUrl);
    }

    const shareContent: Record<string, unknown> = {
      shareCommentary: { attributes: [], text: post.content ?? "" },
      shareMediaCategory: mediaUrn ? "IMAGE" : "NONE",
      media: mediaUrn
        ? [{ media: mediaUrn, status: "READY", title: { attributes: [], text: "Image" } }]
        : [],
    };

    const body = {
      author: personUrn,
      lifecycleState: "PUBLISHED",
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
    };

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return { success: false };

    const respBody = (await res.json()) as { id?: string };
    return { success: true, externalPostId: respBody.id ?? undefined };
  } catch {
    return { success: false };
  }
}

async function uploadImage(
  accessToken: string,
  ownerUrn: string,
  imageUrl: string
): Promise<string | null> {
  try {
    const registerRes = await fetch(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: ownerUrn,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        }),
      }
    );
    if (!registerRes.ok) return null;

    const registerJson = (await registerRes.json()) as {
      value?: {
        uploadMechanism?: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: {
            uploadUrl?: string;
          };
        };
        asset?: string;
      };
    };
    const uploadUrl =
      registerJson.value?.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl;
    const asset = registerJson.value?.asset;
    if (!uploadUrl || !asset) return null;

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return null;
    const imageBytes = await imageRes.arrayBuffer();

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: imageBytes,
    });
    if (!uploadRes.ok) return null;

    return asset;
  } catch {
    return null;
  }
}
