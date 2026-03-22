import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { posts, users, userSocialCredentials, publishLogs } from "@/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import { publishToPlatform } from "@/lib/publishers";
import { sendPostPublished } from "@/lib/services/mailgun-service";
import type { PostToPublish } from "@/lib/publishers/types";

export const maxDuration = 60;

export async function GET(request: Request) {
  return runPublish(request);
}

export async function POST(request: Request) {
  return runPublish(request);
}

async function runPublish(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const dueRows = await db
      .select({
        postId: posts.id,
        userId: posts.userId,
        content: posts.content,
        platform: posts.platform,
        imageUrl: posts.imageUrl,
        script: posts.script,
        metadataJson: posts.metadataJson,
        userEmail: users.email,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(
        and(
          lte(posts.scheduledAt, now),
          eq(posts.status, "Scheduled" as const)
        )
      );

    for (const row of dueRows) {
      let credentials: Record<string, string> | null = null;
      const [credRow] = await db
        .select()
        .from(userSocialCredentials)
        .where(
          and(
            eq(userSocialCredentials.userId, row.userId),
            eq(userSocialCredentials.platform, row.platform)
          )
        )
        .limit(1);

      if (credRow?.credentialJson) {
        try {
          credentials = JSON.parse(credRow.credentialJson) as Record<
            string,
            string
          >;
        } catch {
          /* ignore */
        }
      }

      const postToPublish: PostToPublish = {
        id: row.postId,
        userId: row.userId,
        content: row.content,
        platform: row.platform,
        imageUrl: row.imageUrl,
        script: row.script,
        metadataJson: row.metadataJson,
        userEmail: row.userEmail ?? "",
      };

      const result = await publishToPlatform(postToPublish, credentials);

      let mailgunSentAt: Date | null = null;
      if (result.success && row.userEmail) {
        const preview =
          row.content.length > 200
            ? row.content.slice(0, 200) + "…"
            : row.content;
        const sent = await sendPostPublished(
          row.userEmail,
          row.platform,
          preview
        );
        if (sent) mailgunSentAt = new Date();
      }

      const status = result.success ? "Published" : "Failed";
      const now2 = new Date();

      await db
        .update(posts)
        .set({
          status: status as "Published" | "Failed",
          ...(result.success && {
            publishedAt: now2,
            externalPostId: result.externalPostId ?? null,
          }),
          updatedAt: now2,
        })
        .where(eq(posts.id, row.postId));

      await db.insert(publishLogs).values({
        postId: row.postId,
        platform: row.platform,
        succeeded: result.success,
        errorMessage: null,
        mailgunSentAt,
        createdAt: now2,
      });
    }

    return NextResponse.json({
      message: "Publish run completed",
      processed: dueRows.length,
    });
  } catch (err) {
    console.error("Cron publish failed:", err);
    return NextResponse.json(
      { error: "Publish run failed" },
      { status: 500 }
    );
  }
}
