import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { AUTH_ENABLED } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!AUTH_ENABLED) return NextResponse.json({ enabled: false, user: null });
  const user = await getSessionUser(req);
  return NextResponse.json(
    { enabled: true, user: user ? { id: user.id, email: user.email, name: user.name } : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
