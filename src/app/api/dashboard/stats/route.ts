import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/services/post-service";

export async function GET() {
  try {
    const user = await requireAppUser();
    const stats = await getDashboardStats(user.id);
    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
