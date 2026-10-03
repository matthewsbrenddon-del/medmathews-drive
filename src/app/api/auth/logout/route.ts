import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, clearSessionCookie, getSessionUser } from "@/lib/server/auth";
import { AUTH_ENABLED, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  if (!AUTH_ENABLED) return res;
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const user = await getSessionUser(req);
  if (user) {
    const everywhere = req.nextUrl.searchParams.get("todos") === "1";
    await prisma.session.deleteMany({ where: everywhere ? { userId: user.id } : { id: user.sessionId } });
  }
  return res;
}
