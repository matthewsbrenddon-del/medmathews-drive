"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CloudOff, KeyRound, Laptop, Loader2, LogOut, RefreshCcw, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import {
  changePassword,
  describeDevice,
  listSessions,
  logout,
  revokeSession,
  useAuthStore,
  type DeviceSession,
} from "@/lib/auth/authClient";
import { syncNow, useSyncStatus } from "@/lib/sync/syncEngine";
import { cn } from "@/lib/utils";

function ago(iso: string | null) {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function AccountPanel() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const sync = useSyncStatus();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [pw, setPw] = useState({ atual: "", nova: "", confirma: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (status === "authed") refresh();
  }, [status, refresh]);

  if (status === "disabled") {
    return (
      <section className="card p-5 flex gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning shrink-0">
          <CloudOff size={19} />
        </div>
        <div>
          <p className="font-medium text-foreground">Contas e sincronização desativadas</p>
          <p className="text-sm text-muted-foreground mt-1">
            Seus dados estão salvos só neste navegador. Para entrar com login e acessar de outros dispositivos, o servidor precisa de um banco
            Postgres em <code className="font-metric">DATABASE_URL</code> (veja o README).
          </p>
        </div>
      </section>
    );
  }
  if (status !== "authed" || !user) return null;

  return (
    <section className="card p-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
          <UserRound size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{user.name || user.email}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        </div>
        <button type="button" className="btn-outline btn-sm" onClick={() => logout(false)}>
          <LogOut size={13} /> Sair
        </button>
      </div>

      <div className="rounded-xl bg-muted/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm inline-flex items-center gap-2">
          {sync.status === "syncing" ? (
            <Loader2 size={15} className="animate-spin text-primary" />
          ) : sync.status === "ok" ? (
            <CheckCircle2 size={15} className="text-success" />
          ) : (
            <CloudOff size={15} className="text-warning" />
          )}
          <span className="text-foreground">
            {sync.status === "syncing"
              ? "Sincronizando…"
              : sync.status === "ok"
                ? `Tudo sincronizado ${ago(sync.lastSyncAt)}`
                : sync.status === "offline"
                  ? "Sem internet — as alterações serão enviadas quando voltar"
                  : sync.error ?? "Sincronização pausada"}
          </span>
        </p>
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={busy === "sync"}
          onClick={async () => {
            setBusy("sync");
            await syncNow();
            setBusy(null);
          }}
        >
          <RefreshCcw size={13} /> Sincronizar agora
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground mb-2 inline-flex items-center gap-2">
          <ShieldCheck size={15} className="text-primary" /> Dispositivos conectados
        </p>
        {sessions === null ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const mobile = /iPhone|Android|iPad/.test(s.userAgent ?? "");
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  {mobile ? <Smartphone size={16} className="text-muted-foreground" /> : <Laptop size={16} className="text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {describeDevice(s.userAgent)} {s.atual && <span className="ml-1 rounded-full bg-success/15 text-success text-[10px] px-1.5 py-0.5">este dispositivo</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Ativo {ago(s.lastSeenAt)} · entrou em {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {!s.atual && (
                    <button
                      type="button"
                      className="text-xs text-danger hover:underline"
                      onClick={async () => {
                        await revokeSession(s.id);
                        refresh();
                      }}
                    >
                      Desconectar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {sessions && sessions.length > 1 && (
          <button type="button" className="mt-2 text-xs text-danger hover:underline" onClick={() => logout(true)}>
            Sair de todos os dispositivos
          </button>
        )}
      </div>

      <form
        className="flex flex-col gap-2 border-t border-border pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPwMsg(null);
          if (pw.nova !== pw.confirma) {
            setPwMsg({ ok: false, text: "As senhas novas não conferem." });
            return;
          }
          setBusy("pw");
          try {
            await changePassword(pw.atual, pw.nova);
            setPw({ atual: "", nova: "", confirma: "" });
            setPwMsg({ ok: true, text: "Senha alterada. Os outros dispositivos foram desconectados." });
            refresh();
          } catch (err) {
            setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Não foi possível alterar a senha." });
          } finally {
            setBusy(null);
          }
        }}
      >
        <p className="text-sm font-medium text-foreground inline-flex items-center gap-2">
          <KeyRound size={15} className="text-primary" /> Alterar senha
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <input type="password" autoComplete="current-password" placeholder="Senha atual" value={pw.atual} onChange={(e) => setPw({ ...pw, atual: e.target.value })} className="input py-2 text-sm" />
          <input type="password" autoComplete="new-password" placeholder="Nova senha" value={pw.nova} onChange={(e) => setPw({ ...pw, nova: e.target.value })} className="input py-2 text-sm" />
          <input type="password" autoComplete="new-password" placeholder="Confirmar nova" value={pw.confirma} onChange={(e) => setPw({ ...pw, confirma: e.target.value })} className="input py-2 text-sm" />
        </div>
        {pwMsg && <p className={cn("text-xs", pwMsg.ok ? "text-success" : "text-danger")}>{pwMsg.text}</p>}
        <button type="submit" className="btn-outline btn-sm self-start" disabled={busy === "pw" || !pw.atual || !pw.nova}>
          {busy === "pw" && <Loader2 size={13} className="animate-spin" />} Salvar nova senha
        </button>
      </form>
    </section>
  );
}
