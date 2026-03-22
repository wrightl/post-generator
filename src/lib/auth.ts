import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db/drizzle";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/db/schema";

/**
 * Get the current Clerk user ID (external ID). Returns null if not signed in.
 */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Sync or get app user from DB. Creates user from Clerk on first access.
 * Returns null if not signed in.
 */
export async function getCurrentAppUser(): Promise<User | null> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return null;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.externalId, clerkUserId))
    .limit(1);

  if (existing) return existing;

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    "";
  const name =
    clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
      : clerkUser.firstName ?? clerkUser.lastName ?? null;

  const [inserted] = await db
    .insert(users)
    .values({
      externalId: clerkUserId,
      email: email || `user-${clerkUserId}@placeholder.local`,
      name,
    })
    .returning();

  return inserted ?? null;
}

/**
 * Require auth - throws 401 if not signed in.
 */
export async function requireAuth() {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return clerkUserId;
}

/**
 * Require app user - syncs from Clerk if needed, throws 401 if not signed in.
 * Use in API routes that need the DB user.
 */
export async function requireAppUser(): Promise<User> {
  const user = await getCurrentAppUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
