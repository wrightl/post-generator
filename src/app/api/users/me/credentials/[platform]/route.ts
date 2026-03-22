import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { setCredential } from "@/lib/services/user-service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const user = await requireAppUser();
    const { platform } = await params;
    if (!platform?.trim()) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const body = (await request.json()) as { credentials?: Record<string, string | null> };
    const ok = await setCredential(user.id, platform.trim(), body.credentials ?? null);
    if (!ok) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message.includes("Credential data")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
