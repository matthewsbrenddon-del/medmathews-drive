import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

// ============================================================================
// Autenticação por e-mail e senha.
//
// - Senha: scrypt (N=2^15, r=8, p=1) com sal aleatório por usuário;
//   comparação em tempo constante.
// - Sessão: token aleatório de 256 bits num cookie httpOnly + Secure +
//   SameSite=Lax; o banco guarda só o SHA-256 do token. Validade de 30 dias,
//   renovada com o uso; cada dispositivo tem a sua e pode ser encerrada.
// - Escritas exigem Origin do próprio site (proteção extra contra CSRF).
// - Força bruta: limite de tentativas por e-mail e por IP.
// ============================================================================

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

export const SESSION_COOKIE = "msh_session";
const SESSION_DAYS = 30;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64 };

export const PASSWORD_MIN = 8;
const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "senha123", "senhasenha", "qwertyui", "11111111", "00000000",
  "abcdefgh", "medicina", "medicina123", "residencia", "iloveyou", "admin123", "abc12345", "password1", "12341234",
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Informe um e-mail válido.";
  return null;
}

export function validatePassword(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > 128) return "Senha longa demais (máximo 128 caracteres).";
  if (/^(.)\1+$/.test(password)) return "Escolha uma senha menos previsível.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Essa senha é muito comum — escolha outra.";
  if (email && password.toLowerCase() === email.split("@")[0]) return "A senha não pode ser igual ao seu e-mail.";
  if (!/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password)) return "Use letras e também números ou símbolos.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// Hash fixo usado quando o e-mail não existe — o login leva o mesmo tempo
// e não revela quais e-mails têm conta.
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    dummyHash ??= hashPassword("senha-ficticia-para-tempo-constante");
    stored = await dummyHash;
    await verifyPassword(password, stored);
    return false;
  }
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** Bloqueia escritas vindas de outros sites (além do SameSite=Lax do cookie). */
export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // navegadores sempre mandam Origin em POST/PUT/DELETE de fetch; ferramentas de linha de comando não têm cookie de sessão
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    // origem inválida
  }
  return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
}

export async function createSession(userId: string, req: NextRequest, res: NextResponse) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      ip: clientIp(req).slice(0, 64),
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  sessionId: string;
}

/** Usuário da sessão atual (ou null). Renova a validade com o uso. */
export async function getSessionUser(req: NextRequest): Promise<AuthedUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const session = await prisma.session.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, name: true } } } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > RENEW_AFTER_MS) {
    await prisma.session
      .update({ where: { id }, data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_DAYS * 864e5) } })
      .catch(() => undefined);
  }
  return { ...session.user, sessionId: id };
}

export async function requireUser(req: NextRequest): Promise<AuthedUser | NextResponse> {
  const user = await getSessionUser(req);
  return user ?? NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
}

// ---------------------------------------------------------------------------
// Limite de tentativas
// ---------------------------------------------------------------------------

const WINDOW_MS = 15 * 60 * 1000;

export async function tooManyAttempts(keys: { key: string; max: number }[]): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  for (const { key, max } of keys) {
    const failed = await prisma.authAttempt.count({ where: { key, success: false, createdAt: { gte: since } } });
    if (failed >= max) return true;
  }
  return false;
}

export async function recordAttempt(keys: string[], success: boolean) {
  await prisma.authAttempt.createMany({ data: keys.map((key) => ({ key, success })) });
  // Limpeza oportunista do histórico antigo.
  if (Math.random() < 0.02) {
    await prisma.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } }).catch(() => undefined);
    await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
  }
}

export function authDisabledResponse() {
  return NextResponse.json({ enabled: false, error: "Contas desativadas: configure DATABASE_URL no servidor." }, { status: 503 });
}

export async function readJson<T>(req: NextRequest, maxBytes = 64 * 1024): Promise<T | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Para rotas que gastam recursos (IA, importação, proxy de calendário): com
 * contas ativadas, só usuários logados. Sem banco, a plataforma é local e
 * segue liberada como antes.
 */
export async function guardRoute(req: NextRequest): Promise<NextResponse | null> {
  if (!process.env.DATABASE_URL) return null;
  const user = await getSessionUser(req);
  return user ? null : NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
}
