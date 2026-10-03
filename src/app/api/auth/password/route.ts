import { NextRequest, NextResponse } from "next/server";
import {
  authDisabledResponse,
  checkOrigin,
  hashPassword,
  readJson,
  recordAttempt,
  requireUser,
  tooManyAttempts,
  validatePassword,
  verifyPassword,
} from "@/lib/server/auth";
import { AUTH_ENABLED, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Troca de senha: exige a senha atual e encerra as sessões dos outros dispositivos. */
export async function POST(req: NextRequest) {
  if (!AUTH_ENABLED) return authDisabledResponse();
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson<{ atual?: string; nova?: string }>(req);
  if (!body?.atual || !body.nova) return NextResponse.json({ error: "Informe a senha atual e a nova." }, { status: 400 });
  const key = `password:${auth.id}`;
  if (await tooManyAttempts([{ key, max: 5 }])) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user || !(await verifyPassword(body.atual, user.passwordHash))) {
    await recordAttempt([key], false);
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
  }
  const pwError = validatePassword(body.nova, user.email);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.nova) } });
  await prisma.session.deleteMany({ where: { userId: user.id, NOT: { id: auth.sessionId } } });
  await recordAttempt([key], true);
  return NextResponse.json({ ok: true });
}
