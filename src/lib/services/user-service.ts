import { db } from "@/db/drizzle";
import { users, userSocialCredentials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ALL_PLATFORMS, KEYS_BY_PLATFORM } from "@/lib/social-platform-keys";

export interface UserProfile {
  id: number;
  email: string;
  name: string | null;
  preferredTheme: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface SocialCredentialDto {
  platform: string;
  credentials: Record<string, string | null>;
}

export function toUserProfile(row: {
  id: number;
  email: string;
  name: string | null;
  preferredTheme: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    preferredTheme: row.preferredTheme,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
  };
}

export async function getById(userId: number): Promise<UserProfile | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ? toUserProfile(user) : null;
}

export async function updateProfile(
  userId: number,
  updates: { preferredTheme?: string | null; avatarUrl?: string | null }
): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return false;

  const next: Record<string, unknown> = {};
  if (updates.preferredTheme !== undefined) {
    next.preferredTheme =
      updates.preferredTheme === "light" || updates.preferredTheme === "dark"
        ? updates.preferredTheme
        : null;
  }
  if (updates.avatarUrl !== undefined) {
    if (updates.avatarUrl && updates.avatarUrl.length > 2_000_000) {
      throw new Error("Avatar URL must be 2,000,000 characters or less.");
    }
    next.avatarUrl = updates.avatarUrl;
  }

  if (Object.keys(next).length === 0) return true;

  await db.update(users).set(next).where(eq(users.id, userId));
  return true;
}

export async function getCredentials(
  userId: number
): Promise<SocialCredentialDto[]> {
  const stored = await db
    .select({ platform: userSocialCredentials.platform, credentialJson: userSocialCredentials.credentialJson })
    .from(userSocialCredentials)
    .where(eq(userSocialCredentials.userId, userId));

  const storedMap = new Map(
    stored.map((s) => [s.platform.toLowerCase(), s.credentialJson])
  );

  const result: SocialCredentialDto[] = [];
  for (const platform of ALL_PLATFORMS) {
    const keys = KEYS_BY_PLATFORM[platform] ?? [];
    const masked: Record<string, string | null> = {};
    const json = storedMap.get(platform.toLowerCase());
    if (json) {
      try {
        const dict = JSON.parse(json) as Record<string, string | null>;
        for (const key of keys) {
          masked[key] = dict[key] && dict[key]!.length > 0 ? "***" : null;
        }
      } catch {
        for (const key of keys) masked[key] = null;
      }
    } else {
      for (const key of keys) masked[key] = null;
    }
    result.push({ platform, credentials: masked });
  }
  return result;
}

export async function setCredential(
  userId: number,
  platform: string,
  credentials: Record<string, string | null> | null
): Promise<boolean> {
  const platformTrimmed = platform.trim();
  if (!platformTrimmed || platformTrimmed.length > 32) return false;

  const [existing] = await db
    .select()
    .from(userSocialCredentials)
    .where(
      and(
        eq(userSocialCredentials.userId, userId),
        eq(userSocialCredentials.platform, platformTrimmed)
      )
    )
    .limit(1);

  const dict: Record<string, string | null> = existing
    ? (JSON.parse(existing.credentialJson) as Record<string, string | null>)
    : {};

  if (credentials) {
    for (const [key, value] of Object.entries(credentials)) {
      if (!value) delete dict[key];
      else dict[key] = value;
    }
  }

  const json = JSON.stringify(dict);
  if (json.length > 8000) {
    throw new Error("Credential data exceeds maximum size of 8000 characters.");
  }

  const now = new Date();
  if (existing) {
    await db
      .update(userSocialCredentials)
      .set({ credentialJson: json, updatedAt: now })
      .where(eq(userSocialCredentials.id, existing.id));
  } else {
    await db.insert(userSocialCredentials).values({
      userId,
      platform: platformTrimmed,
      credentialJson: json,
      updatedAt: now,
    });
  }
  return true;
}
