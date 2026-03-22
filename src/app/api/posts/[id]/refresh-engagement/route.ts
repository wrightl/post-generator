import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { refreshEngagement } from "@/lib/services/engagement-service";

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
    const post = await refreshEngagement(user.id, id);
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
