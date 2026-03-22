export const ALL_PLATFORMS = [
  "LinkedIn",
  "Bluesky",
  "Instagram",
  "Facebook",
  "TikTok",
  "Skool",
] as const;

export const KEYS_BY_PLATFORM: Record<string, string[]> = {
  LinkedIn: ["AccessToken", "PersonUrn"],
  Bluesky: ["Handle", "AppPassword", "PdsUrl"],
  Instagram: ["UserId", "AccessToken"],
  Facebook: ["PageId", "PageAccessToken"],
  TikTok: ["AccessToken"],
  Skool: ["ApiKey", "SessionId", "GroupId"],
};
