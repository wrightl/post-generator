import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { getById } from "@/lib/services/post-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    const id = parseInt((await params).id, 10);
    if (isNaN(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const post = await getById(user.id, id);
    if (!post || !post.imageUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.redirect(post.imageUrl);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    const id = parseInt((await params).id, 10);
    if (isNaN(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const { setPostImageUrl } = await import("@/lib/services/post-service");
    const updated = await setPostImageUrl(user.id, id, null);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
