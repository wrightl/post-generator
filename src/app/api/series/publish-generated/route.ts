import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { publishGenerated } from "@/lib/services/series-service";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as {
      topicDetail: string;
      numPosts: number;
      platform: string;
      generatedPosts: Array<{
        content: string;
        script?: string | null;
        metadataJson?: string | null;
        imageUrl?: string | null;
      }>;
      linked?: boolean;
      tone?: string | null;
      length?: string | null;
      generateImages?: boolean;
      tiktokScriptDurationSeconds?: number | null;
      startDate?: string | null;
      recurrence?: string | null;
      scheduledTimeOfDay?: string | null;
    };

    if (!body.generatedPosts?.length) {
      return NextResponse.json(
        { message: "generatedPosts is required" },
        { status: 400 }
      );
    }

    const result = await publishGenerated(user.id, {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message === "Invalid platform") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
