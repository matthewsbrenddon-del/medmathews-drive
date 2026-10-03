"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Flame, Timer } from "lucide-react";
import { FocusTimerCore } from "@/components/FocusTimer";
import { STUDY_KIND_LABELS, unionSeconds, useStudySessionStore } from "@/lib/studySessionStore";
import { cn } from "@/lib/utils";

function dayStart(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function fmtMin(sec: number) {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

export default function FocoPage() {
  const sessions = useStudySessionStore((s) => s.sessions);

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const start = dayStart(i - 6);
        const end = dayStart(i - 5);
        const list = sessions.filter((s) => s.startedAt >= start.toISOString() && s.startedAt < end.toISOString());
        return { date: start, seconds: unionSeconds(list) };
      }),
    [sessions]
  );
  const max = Math.max(3600, ...week.map((d) => d.seconds));
  const today = useMemo(
    () => sessions.filter((s) => s.startedAt >= dayStart(0).toISOString()).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions]
  );
  const weekTotal = unionSeconds(sessions.filter((s) => s.startedAt >= dayStart(-6).toISOString()));
  let streak = 0;
  for (let i = week.length - 1; i >= 0; i--) {
    if (week[i].seconds >= 600) streak++;
    else if (i < week.length - 1) break;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground inline-flex items-center gap-2.5">
            <Timer size={22} className="text-accent" /> Modo foco
          </h1>
          <p className="text-muted-foreground mt-1">
            Pomodoro, cronômetro ou timer — avulso ou ligado ao que você está estudando. O tempo entra nas suas horas líquidas e na
            Agenda.
          </p>
        </div>
        <Link href="/agenda" className="btn-outline btn-sm">
          <CalendarDays size={14} /> Ver na agenda
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <section className="card relative overflow-hidden p-8 flex justify-center">
          <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative w-full max-w-sm">
            <FocusTimerCore size="lg" />
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Últimos 7 dias</h2>
              <span className="text-xs text-muted-foreground font-metric inline-flex items-center gap-1">
                <Flame size={12} className="text-warning" /> {streak}d · {fmtMin(weekTotal)}
              </span>
            </div>
            <div className="flex items-end gap-2 h-32">
              {week.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-metric text-muted-foreground">{d.seconds >= 60 ? Math.round(d.seconds / 60) : ""}</span>
                  <div
                    className={cn("w-full rounded-md transition-all", i === 6 ? "bg-primary" : "bg-primary/40")}
                    style={{ height: `${Math.max(3, (d.seconds / max) * 100)}%` }}
                    title={`${d.date.toLocaleDateString("pt-BR")}: ${fmtMin(d.seconds)}`}
                  />
                  <span className={cn("text-[10px] uppercase", i === 6 ? "text-primary font-semibold" : "text-muted-foreground")}>
                    {d.date.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Minutos por dia, somando Pomodoro e as sessões da plataforma sem contar em dobro.</p>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-foreground mb-3">Hoje</h2>
            {today.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sessão ainda. Dê o play e comece um foco de 25 minutos.</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {today.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", s.kind === "foco" ? "bg-primary" : "bg-accent")} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-foreground truncate">{s.label || STUDY_KIND_LABELS[s.kind]}</span>
                      <span className="block text-[11px] text-muted-foreground font-metric inline-flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(s.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–
                        {new Date(s.endedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className="text-xs font-metric text-muted-foreground">{fmtMin(s.durationSeconds)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
