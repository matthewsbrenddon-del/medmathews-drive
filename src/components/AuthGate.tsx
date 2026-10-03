"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { loadSession, useAuthStore } from "@/lib/auth/authClient";

const PUBLIC_PATHS = ["/entrar"];

/**
 * Com contas ativadas (servidor com DATABASE_URL), só entra quem fez login, e
 * as telas só aparecem depois de baixar os dados da conta. Sem banco
 * configurado, a plataforma segue funcionando só neste navegador.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const ready = useAuthStore((s) => s.ready);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (useAuthStore.getState().status === "loading") loadSession();
  }, []);

  useEffect(() => {
    if (status === "anon" && !isPublic) router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
  }, [status, isPublic, pathname, router]);

  if (isPublic || status === "disabled" || (status === "authed" && ready)) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground animate-pulse">
        <Logo size={23} />
      </div>
      <p className="text-sm text-muted-foreground">{status === "authed" ? "Sincronizando seus dados…" : "Carregando o MedStudy Hub…"}</p>
    </div>
  );
}
