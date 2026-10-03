"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Eye, EyeOff, Laptop, Loader2, Lock, ShieldCheck, Smartphone, Timer } from "lucide-react";
import { Logo } from "@/components/Logo";
import { login, signup, useAuthStore } from "@/lib/auth/authClient";
import { useStudyStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const s = Math.min(4, score);
  return { score: s, label: ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][s] };
}

function EntrarContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/entrar") ? next : "/";
  const status = useAuthStore((s) => s.status);
  const ready = useAuthStore((s) => s.ready);

  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (status === "authed" && ready) router.replace(safeNext);
  }, [status, ready, router, safeNext]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "criar" && password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "entrar") await login(email, password);
      else {
        if (!useStudyStore.getState().studentName.trim()) useStudyStore.getState().setStudentName(name.trim());
        await signup(name, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* Apresentação */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 bg-gradient-to-br from-primary/25 via-background to-accent/20 border-r border-border">
        <svg aria-hidden viewBox="0 0 600 200" className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full opacity-30 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M0 120 H180 L205 80 L225 160 L250 40 L275 140 L295 120 H600" />
        </svg>
        <div className="relative flex items-center gap-3">
          <span className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground inline-flex items-center justify-center shadow-lift">
            <Logo size={22} />
          </span>
          <span className="text-xl font-semibold text-foreground">MedStudy Hub</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight text-foreground">Seu estudo, em qualquer dispositivo.</h1>
          <p className="mt-4 text-muted-foreground">
            Comece a resolver questões no celular, continue no computador. Progresso, cadernos, quizzes, cronograma e agenda
            sincronizados com a sua conta.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-sm text-foreground/90">
            <li className="inline-flex items-center gap-3">
              <Smartphone size={16} className="text-primary" /> <Laptop size={16} className="text-primary -ml-2" /> Celular, tablet e computador sempre iguais
            </li>
            <li className="inline-flex items-center gap-3">
              <Timer size={16} className="text-primary" /> Pomodoro e horas líquidas de estudo
            </li>
            <li className="inline-flex items-center gap-3">
              <CalendarDays size={16} className="text-primary" /> Agenda com Google Agenda, Kanban e to-do
            </li>
            <li className="inline-flex items-center gap-3">
              <ShieldCheck size={16} className="text-primary" /> Senha criptografada e controle dos dispositivos conectados
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Feito para quem estuda para residência, Revalida e ENAMED.</p>
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground inline-flex items-center justify-center">
              <Logo size={20} />
            </span>
            <span className="text-lg font-semibold text-foreground">MedStudy Hub</span>
          </div>

          <h2 className="text-2xl font-semibold text-foreground">{mode === "entrar" ? "Entrar" : "Criar sua conta"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "entrar" ? "Bem-vindo de volta. Seus dados são sincronizados ao entrar." : "Leva 30 segundos — o que você já estudou neste navegador vai junto."}
          </p>

          {status === "disabled" ? (
            <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
              As contas ainda não foram ativadas neste servidor (falta configurar o banco de dados — <code className="font-metric">DATABASE_URL</code>).
              Enquanto isso, a plataforma funciona normalmente, salvando só neste navegador.
              <button type="button" className="btn-primary w-full mt-4" onClick={() => router.replace("/")}>
                Continuar sem conta
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 rounded-xl border border-border p-1 bg-muted/60 text-sm">
                {(["entrar", "criar"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    className={cn("py-2 rounded-lg font-medium transition-colors", mode === m ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}
                  >
                    {m === "entrar" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-5 flex flex-col gap-3.5" noValidate>
                {mode === "criar" && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Nome</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} className="input" placeholder="Como quer ser chamado(a)" />
                  </label>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">E-mail</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="input" placeholder="voce@email.com" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Senha</span>
                  <span className="relative">
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                      required
                      minLength={8}
                      maxLength={128}
                      className="input pr-10"
                      placeholder={mode === "criar" ? "Mínimo de 8 caracteres" : "Sua senha"}
                    />
                    <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>
                {mode === "criar" && password && (
                  <div>
                    <div className="grid grid-cols-4 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn("h-1.5 rounded-full", i < strength.score ? (strength.score >= 3 ? "bg-success" : strength.score === 2 ? "bg-warning" : "bg-danger") : "bg-muted")}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Força da senha: {strength.label}. Use letras e números ou símbolos.
                    </p>
                  </div>
                )}
                {mode === "criar" && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Confirmar senha</span>
                    <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required className="input" />
                  </label>
                )}

                {error && <p className="text-sm text-danger" role="alert">{error}</p>}

                <button type="submit" className="btn-primary w-full py-3 mt-1" disabled={busy || !email || !password || (mode === "criar" && (!name.trim() || !confirm))}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
                  {busy ? (status === "authed" ? "Sincronizando…" : "Aguarde…") : mode === "entrar" ? "Entrar" : "Criar conta"}
                </button>
              </form>

              <p className="mt-6 text-[11px] text-muted-foreground leading-relaxed">
                Sua senha é guardada criptografada (scrypt) e nunca é enviada a terceiros. O login fica salvo neste dispositivo por 30 dias; você pode
                encerrar sessões em Configurações → Conta e dispositivos.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <EntrarContent />
    </Suspense>
  );
}
