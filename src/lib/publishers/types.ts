export type PostPlatform =
  | "LinkedIn"
  | "Skool"
  | "Instagram"
  | "Bluesky"
  | "Facebook"
  | "TikTok";

export interface PostToPublish {
  id: number;
  userId: number;
  content: string;
  platform: PostPlatform;
  imageUrl: string | null;
  script: string | null;
  metadataJson: string | null;
  userEmail: string;
}

export interface PublishResult {
  success: boolean;
  externalPostId?: string;
}

export type PublisherFn = (
  post: PostToPublish,
  credentials: Record<string, string> | null
) => Promise<PublishResult>;
