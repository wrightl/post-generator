import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import {
  list,
  create,
  type CreatePostRequest,
} from "@/lib/services/post-service";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const { searchParams } = new URL(request.url);
    const platforms = searchParams.getAll("platform").filter(Boolean);
    const statuses = searchParams.getAll("status").filter(Boolean);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    const skip = Math.max(0, (page - 1) * pageSize);
    const take = Math.min(100, Math.max(1, pageSize));

    const result = await list(user.id, {
      platforms: platforms.length ? platforms : undefined,
      statuses: statuses.length ? statuses : undefined,
      from,
      to,
      skip,
      take,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as CreatePostRequest;
    if (!body.topicSummary || !body.platform) {
      return NextResponse.json(
        { error: "topicSummary and platform are required" },
        { status: 400 }
      );
    }
    const post = await create(user.id, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message === "Invalid platform") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
