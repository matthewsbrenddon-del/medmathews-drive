import { NextRequest, NextResponse } from "next/server";
import {
  authDisabledResponse,
  checkOrigin,
  clientIp,
  createSession,
  normalizeEmail,
  readJson,
  recordAttempt,
  tooManyAttempts,
  verifyPassword,
} from "@/lib/server/auth";
import { AUTH_ENABLED, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) return authDisabledResponse();
  const blocked = checkOrigin(req);
  if (blocked) return blocked;

  const body = await readJson<{ email?: string; password?: string }>(req);
  if (!body) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  const email = normalizeEmail(body.email ?? "").slice(0, 254);
  const password = (body.password ?? "").slice(0, 128);

  const keys = [`login-email:${email}`, `login-ip:${clientIp(req)}`];
  if (await tooManyAttempts([{ key: keys[0], max: 5 }, { key: keys[1], max: 20 }])) {
    return NextResponse.json({ error: "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo." }, { status: 429 });
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) {
    await recordAttempt(keys, false);
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }
  await recordAttempt(keys, true);
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  await createSession(user.id, req, res);
  return res;
}
