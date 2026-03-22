import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { toUserProfile } from "@/lib/services/user-service";

export async function POST() {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(toUserProfile(user));
}
