import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import {
  getById,
  updateProfile,
  toUserProfile,
} from "@/lib/services/user-service";

export async function GET() {
  try {
    const user = await requireAppUser();
    const profile = await getById(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as {
      preferredTheme?: string | null;
      avatarUrl?: string | null;
    };
    const ok = await updateProfile(user.id, {
      preferredTheme: body.preferredTheme,
      avatarUrl: body.avatarUrl,
    });
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message.includes("Avatar URL")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
