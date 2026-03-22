import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import {
  getById,
  update,
  remove,
  type UpdatePostRequest,
} from "@/lib/services/post-service";

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
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    const id = parseInt((await params).id, 10);
    if (isNaN(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = (await request.json()) as UpdatePostRequest;
    const post = await update(user.id, id, {
      ...body,
      scheduledAt: body.scheduledAt
        ? new Date(body.scheduledAt as unknown as string)
        : body.scheduledAt,
    });
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(post);
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
    const deleted = await remove(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
