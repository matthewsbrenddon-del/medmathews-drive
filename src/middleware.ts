import { NextRequest, NextResponse } from "next/server";

/**
 * Com contas ativadas (DATABASE_URL definido), quem chega sem cookie de sessão
 * vai direto para /entrar. A validação real da sessão acontece no servidor, em
 * cada rota de API (getSessionUser) — aqui é só o atalho de redirecionamento.
 */
export function middleware(req: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next();
  if (req.cookies.get("msh_session")?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/entrar";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|entrar|seed-data|fonts|icon.svg|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|json|txt|ttf|woff2?)$).*)"],
};
