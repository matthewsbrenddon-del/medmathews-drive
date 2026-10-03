import { NextRequest, NextResponse } from "next/server";
import {
  authDisabledResponse,
  checkOrigin,
  clientIp,
  createSession,
  hashPassword,
  normalizeEmail,
  readJson,
  recordAttempt,
  tooManyAttempts,
  validateEmail,
  validatePassword,
} from "@/lib/server/auth";
import { AUTH_ENABLED, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) return authDisabledResponse();
  const blocked = checkOrigin(req);
  if (blocked) return blocked;

  const body = await readJson<{ name?: string; email?: string; password?: string }>(req);
  if (!body) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  const name = (body.name ?? "").trim().slice(0, 80);
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";

  const ipKey = `signup-ip:${clientIp(req)}`;
  if (await tooManyAttempts([{ key: ipKey, max: 10 }])) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }, { status: 429 });
  }
  if (!name) return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  const emailError = validateEmail(email);
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 });
  const pwError = validatePassword(password, email);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) {
    await recordAttempt([ipKey], false);
    return NextResponse.json({ error: "Já existe uma conta com esse e-mail. Entre com a sua senha." }, { status: 409 });
  }

  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await recordAttempt([ipKey], true);
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  await createSession(user.id, req, res);
  return res;
}
