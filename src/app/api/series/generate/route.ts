import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { generate } from "@/lib/services/series-service";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as {
      topicDetail: string;
      numPosts: number;
      platform: string;
      linked?: boolean;
      tone?: string | null;
      length?: string | null;
      generateImages?: boolean;
      tiktokScriptDurationSeconds?: number | null;
      startDate?: string | null;
      recurrence?: string | null;
      scheduledTimeOfDay?: string | null;
    };

    const provider = process.env.AI_PROVIDER ?? "";
    if (
      provider.toLowerCase() === "anthropic" &&
      body.generateImages === true
    ) {
      return NextResponse.json(
        {
          message:
            "Image generation is not available when using Claude. Switch to Azure OpenAI or disable image generation.",
        },
        { status: 400 }
      );
    }

    const result = await generate(user.id, {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
    });

    if (!result) {
      return NextResponse.json(
        { message: "No posts generated." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
