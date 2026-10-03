import { NextRequest, NextResponse } from "next/server";
import { authDisabledResponse, checkOrigin, readJson, requireUser } from "@/lib/server/auth";
import { AUTH_ENABLED, prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Sincronização entre dispositivos. Cada "store" do app (progresso, caderno,
 * quizzes, agenda…) é um bloco JSON por usuário. Vence a alteração mais
 * recente (horário do dispositivo, limitado ao horário do servidor para um
 * relógio adiantado não "ganhar" para sempre).
 */

const KEY_RE = /^medstudy-hub-[a-z0-9-]{1,40}$/;
const MAX_KEY_BYTES = 4 * 1024 * 1024;
const MAX_USER_BYTES = 40 * 1024 * 1024;
const MAX_BODY_BYTES = 16 * 1024 * 1024;

interface IncomingState {
  key: string;
  data: string;
  modifiedAt: string;
}

export async function GET(req: NextRequest) {
  if (!AUTH_ENABLED) return authDisabledResponse();
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;
  const states = await prisma.userState.findMany({
    where: { userId: auth.id, ...(sinceDate && !Number.isNaN(sinceDate.getTime()) ? { updatedAt: { gt: sinceDate } } : {}) },
    select: { key: true, data: true, modifiedAt: true, updatedAt: true },
  });
  return NextResponse.json(
    { serverTime: new Date().toISOString(), states: states.map((s) => ({ key: s.key, data: s.data, modifiedAt: s.modifiedAt.toISOString() })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(req: NextRequest) {
  if (!AUTH_ENABLED) return authDisabledResponse();
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson<{ states?: IncomingState[] }>(req, MAX_BODY_BYTES);
  if (!body || !Array.isArray(body.states) || body.states.length > 50) {
    return NextResponse.json({ error: "Requisição inválida ou grande demais." }, { status: 400 });
  }

  const now = Date.now();
  const valid: { key: string; data: string; modifiedAt: Date }[] = [];
  for (const s of body.states) {
    if (typeof s?.key !== "string" || !KEY_RE.test(s.key) || typeof s.data !== "string") continue;
    if (s.data.length > MAX_KEY_BYTES) return NextResponse.json({ error: `Dados de "${s.key}" grandes demais.` }, { status: 413 });
    const t = new Date(s.modifiedAt);
    if (Number.isNaN(t.getTime())) continue;
    valid.push({ key: s.key, data: s.data, modifiedAt: new Date(Math.min(t.getTime(), now)) });
  }

  const existing = await prisma.userState.findMany({
    where: { userId: auth.id },
    select: { key: true, modifiedAt: true, data: true },
  });
  const byKey = new Map(existing.map((e) => [e.key, e]));

  // Cota por usuário.
  let total = existing.reduce((sum, e) => sum + e.data.length, 0);
  for (const v of valid) total += v.data.length - (byKey.get(v.key)?.data.length ?? 0);
  if (total > MAX_USER_BYTES) return NextResponse.json({ error: "Limite de armazenamento da conta atingido." }, { status: 413 });

  const applied: string[] = [];
  const newer: { key: string; data: string; modifiedAt: string }[] = [];
  for (const v of valid) {
    const cur = byKey.get(v.key);
    if (cur && cur.modifiedAt.getTime() > v.modifiedAt.getTime()) {
      newer.push({ key: cur.key, data: cur.data, modifiedAt: cur.modifiedAt.toISOString() });
      continue;
    }
    await prisma.userState.upsert({
      where: { userId_key: { userId: auth.id, key: v.key } },
      create: { userId: auth.id, key: v.key, data: v.data, modifiedAt: v.modifiedAt },
      update: { data: v.data, modifiedAt: v.modifiedAt },
    });
    applied.push(v.key);
  }
  return NextResponse.json({ applied, newer, serverTime: new Date().toISOString() });
}
