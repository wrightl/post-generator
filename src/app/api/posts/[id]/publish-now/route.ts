import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { publishNow } from "@/lib/services/post-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    const id = parseInt((await params).id, 10);
    if (isNaN(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const post = await publishNow(user.id, id);
    if (!post) {
      return NextResponse.json(
        { message: "Post not found or is not a draft." },
        { status: 400 }
      );
    }
    return NextResponse.json(post);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
