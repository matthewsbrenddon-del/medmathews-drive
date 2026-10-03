import { NextRequest, NextResponse } from "next/server";
import { authDisabledResponse, checkOrigin, requireUser } from "@/lib/server/auth";
import { AUTH_ENABLED, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Dispositivos conectados à conta. */
export async function GET(req: NextRequest) {
  if (!AUTH_ENABLED) return authDisabledResponse();
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const sessions = await prisma.session.findMany({
    where: { userId: auth.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, userAgent: true },
  });
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      // O id é o hash do token — devolvemos só um prefixo para identificar/encerrar.
      id: s.id.slice(0, 16),
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      userAgent: s.userAgent,
      atual: s.id === auth.sessionId,
    })),
  });
}

/** Encerra uma sessão (?id=prefixo). */
export async function DELETE(req: NextRequest) {
  if (!AUTH_ENABLED) return authDisabledResponse();
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const prefix = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{16}$/.test(prefix)) return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });
  await prisma.session.deleteMany({ where: { userId: auth.id, id: { startsWith: prefix } } });
  return NextResponse.json({ ok: true });
}
