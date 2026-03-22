import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { generateStream } from "@/lib/services/series-service";

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

    if (body.generateImages === true) {
      return NextResponse.json(
        {
          message:
            "Image generation is not supported. Disable image generation.",
        },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let first = true;
          await generateStream(
            user.id,
            {
              ...body,
              startDate: body.startDate ? new Date(body.startDate) : undefined,
            },
            async (seriesId, post) => {
              if (first) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ seriesId }) + "\n")
                );
                first = false;
              }
              controller.enqueue(
                encoder.encode(JSON.stringify({ post }) + "\n")
              );
            }
          );
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                error: err instanceof Error ? err.message : "Unknown error",
              }) + "\n"
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
