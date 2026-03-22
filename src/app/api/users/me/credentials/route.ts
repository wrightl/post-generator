import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { getCredentials } from "@/lib/services/user-service";

export async function GET() {
  try {
    const user = await requireAppUser();
    const list = await getCredentials(user.id);
    return NextResponse.json(list);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
