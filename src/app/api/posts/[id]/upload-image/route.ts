import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { getById, setPostImageUrl } from "@/lib/services/post-service";
import { uploadImage } from "@/lib/services/image-service";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(
  request: Request,
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
    if (post.status !== "Draft" && post.status !== "Scheduled") {
      return NextResponse.json(
        { message: "Only draft or scheduled posts can have an image uploaded." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json(
        { message: "No file or empty file." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { message: "File size must be 5MB or less." },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "Allowed types: image/jpeg, image/png, image/webp, image/gif." },
        { status: 400 }
      );
    }

    const stream = file.stream();
    const url = await uploadImage(stream, id.toString(), file.type);
    const updated = await setPostImageUrl(user.id, id, url);
    return NextResponse.json(updated!);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
