"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BellOff, Coffee, Link2, Maximize2, Pause, Play, RotateCcw, Settings2, SkipForward, Timer, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useCadernoDockStore } from "@/lib/cadernoDockStore";
import {
  PHASE_LABEL,
  elapsedMs,
  formatClock,
  playChime,
  targetMs,
  useFocusTimerStore,
  type TimerMode,
} from "@/lib/focusTimerStore";
import { unionSeconds, useStudySessionStore } from "@/lib/studySessionStore";
import { cn } from "@/lib/utils";

const MODES: { id: TimerMode; label: string }[] = [
  { id: "pomodoro", label: "Pomodoro" },
  { id: "cronometro", label: "Cronômetro" },
  { id: "timer", label: "Timer" },
];

const PATH_CONTEXT: [RegExp, string][] = [
  [/^\/questoes\/prova/, "Simulado"],
  [/^\/questoes/, "Resolvendo questões"],
  [/^\/listas/, "Minhas listas"],
  [/^\/flashcards/, "Flashcards"],
  [/^\/quizzes/, "Quiz"],
  [/^\/caderno/, "Caderno"],
  [/^\/(disciplinas|videoaulas|materiais)/, "Aulas e materiais"],
  [/^\/cronograma/, "Cronograma"],
];

/** O que o aluno está estudando agora: o conteúdo aberto (aula/questão) ou a seção da plataforma. */
export function useStudyContext(): string | null {
  const pathname = usePathname() ?? "";
  const dockContext = useCadernoDockStore((s) => s.context);
  if (dockContext?.label) return dockContext.label;
  return PATH_CONTEXT.find(([re]) => re.test(pathname))?.[1] ?? null;
}

/** Relógio compartilhado: re-renderiza enquanto roda e encerra a fase no tempo certo. */
export function useTimerClock() {
  const status = useFocusTimerStore((s) => s.status);
  const tick = useFocusTimerStore((s) => s.tick);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    tick();
    if (status !== "running") return;
    const id = setInterval(() => {
      setNow(Date.now());
      tick();
    }, 250);
    return () => clearInterval(id);
  }, [status, tick]);
  return now;
}

export function useTimerView() {
  const now = useTimerClock();
  const state = useFocusTimerStore();
  const target = targetMs(state);
  const elapsed = elapsedMs(state, now);
  const display = target === null ? elapsed : Math.max(0, target - elapsed);
  const progress = target === null ? (elapsed % 3_600_000) / 3_600_000 : Math.min(1, elapsed / target);
  const isBreak = state.mode === "pomodoro" && state.phase !== "foco";
  return { state, target, elapsed, display, progress, isBreak };
}

function Ring({ progress, size, stroke, isBreak, running }: { progress: number; size: number; stroke: number; isBreak: boolean; running: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke="currentColor"
        className={cn("transition-[stroke-dashoffset] duration-300", isBreak ? "text-success" : "text-primary", running && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]")}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
      />
    </svg>
  );
}

/** Núcleo do timer (usado no painel flutuante e na página /foco). */
export function FocusTimerCore({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { state, display, progress, isBreak } = useTimerView();
  const context = useStudyContext();
  const [showSettings, setShowSettings] = useState(false);
  const sessions = useStudySessionStore((s) => s.sessions);
  const todayFocusMin = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.round(unionSeconds(sessions.filter((s) => s.startedAt >= d.toISOString())) / 60);
  }, [sessions]);

  const lg = size === "lg";
  const ringSize = lg ? 300 : 168;
  const running = state.status === "running";
  const focosHoje = state.focosHoje.date === new Date().toISOString().slice(0, 10) ? state.focosHoje.count : 0;

  return (
    <div className={cn("flex flex-col items-center", lg ? "gap-6" : "gap-4")}>
      <div className="inline-flex rounded-xl border border-border p-0.5 bg-muted/60 text-xs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => state.setMode(m.id)}
            className={cn("px-3 py-1.5 rounded-lg font-medium transition-colors", state.mode === m.id ? "bg-surface shadow-card text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        <Ring progress={progress} size={ringSize} stroke={lg ? 12 : 8} isBreak={isBreak} running={running} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-[11px] uppercase tracking-[0.18em] font-semibold", isBreak ? "text-success" : "text-primary")}>
            {state.mode === "pomodoro" ? PHASE_LABEL[state.phase] : state.mode === "cronometro" ? "Cronômetro" : "Timer"}
          </span>
          <span className={cn("font-metric text-foreground tabular-nums", lg ? "text-6xl mt-1" : "text-4xl")}>{formatClock(display)}</span>
          {state.mode === "pomodoro" && (
            <span className="mt-2 flex gap-1" aria-label={`${state.ciclos % state.settings.ciclosAteLonga} de ${state.settings.ciclosAteLonga} focos no ciclo`}>
              {Array.from({ length: state.settings.ciclosAteLonga }).map((_, i) => (
                <span key={i} className={cn("h-1.5 w-4 rounded-full", i < state.ciclos % state.settings.ciclosAteLonga ? "bg-primary" : "bg-muted")} />
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={state.reset} className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground" title="Reiniciar">
          <RotateCcw size={16} />
        </button>
        {running ? (
          <button type="button" onClick={state.pause} className={cn("btn-primary rounded-full", lg ? "px-8 py-3 text-base" : "px-6")}>
            <Pause size={lg ? 18 : 16} /> Pausar
          </button>
        ) : (
          <button type="button" onClick={() => state.start(context ?? undefined)} className={cn("btn-primary rounded-full", lg ? "px-8 py-3 text-base" : "px-6")}>
            <Play size={lg ? 18 : 16} /> {state.status === "paused" ? "Continuar" : isBreak ? "Iniciar pausa" : "Iniciar"}
          </button>
        )}
        <button
          type="button"
          onClick={state.skip}
          className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
          title={state.mode === "pomodoro" ? (isBreak ? "Pular pausa" : "Pular para a pausa") : "Encerrar"}
        >
          <SkipForward size={16} />
        </button>
      </div>

      <div className="w-full flex flex-col gap-2">
        <input
          value={state.label}
          onChange={(e) => state.setLabel(e.target.value)}
          placeholder="O que você vai estudar? (ex.: Cardiologia — ICC)"
          className="input py-2 text-sm text-center"
          aria-label="O que você está estudando"
        />
        {context && state.label !== context && (
          <button
            type="button"
            onClick={() => state.setLabel(context)}
            className="self-center inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 px-3 py-1 text-[11px] text-primary hover:bg-primary/5 max-w-full"
          >
            <Link2 size={11} className="shrink-0" /> <span className="truncate">Vincular a: {context}</span>
          </button>
        )}
      </div>

      <div className="w-full grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 py-2">
          <p className="font-metric text-lg text-foreground">{todayFocusMin} min</p>
          <p className="text-[10px] text-muted-foreground">estudados hoje</p>
        </div>
        <div className="rounded-xl bg-muted/50 py-2">
          <p className="font-metric text-lg text-foreground">{focosHoje} 🍅</p>
          <p className="text-[10px] text-muted-foreground">pomodoros hoje</p>
        </div>
      </div>

      <div className="w-full">
        <button type="button" onClick={() => setShowSettings((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <Settings2 size={13} /> Ajustes
        </button>
        {showSettings && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs animate-fade-in">
            {(
              [
                ["focoMin", "Foco (min)"],
                ["pausaMin", "Pausa (min)"],
                ["pausaLongaMin", "Pausa longa (min)"],
                ["ciclosAteLonga", "Focos até a longa"],
                ["timerMin", "Timer (min)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-muted-foreground">{label}</span>
                <input
                  type="number"
                  min={1}
                  max={key === "ciclosAteLonga" ? 12 : 480}
                  value={state.settings[key]}
                  onChange={(e) => state.setSettings({ [key]: Math.max(1, Number(e.target.value) || 1) })}
                  className="input py-1 text-sm"
                />
              </label>
            ))}
            <div className="flex flex-col gap-1.5 justify-end">
              <button type="button" onClick={() => state.setSettings({ autoIniciar: !state.settings.autoIniciar })} className={cn("inline-flex items-center gap-1.5", state.settings.autoIniciar ? "text-primary" : "text-muted-foreground")}>
                <Zap size={13} /> Auto-iniciar {state.settings.autoIniciar ? "ligado" : "desligado"}
              </button>
              <button type="button" onClick={() => state.setSettings({ som: !state.settings.som })} className={cn("inline-flex items-center gap-1.5", state.settings.som ? "text-primary" : "text-muted-foreground")}>
                {state.settings.som ? <Volume2 size={13} /> : <VolumeX size={13} />} Som
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !state.settings.notificacao;
                  state.setSettings({ notificacao: next });
                  if (next && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
                }}
                className={cn("inline-flex items-center gap-1.5", state.settings.notificacao ? "text-primary" : "text-muted-foreground")}
              >
                {state.settings.notificacao ? <Bell size={13} /> : <BellOff size={13} />} Notificação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Alarmes (som + notificação) e título da aba — montado uma vez no layout. */
function useTimerSideEffects(display: number, active: boolean, label: string) {
  const alarm = useFocusTimerStore((s) => s.alarm);
  const settings = useFocusTimerStore((s) => s.settings);
  const lastAlarm = useRef<number | null>(null);
  const baseTitle = useRef<string | null>(null);

  useEffect(() => {
    if (!alarm || alarm.at === lastAlarm.current) return;
    const first = lastAlarm.current === null && Date.now() - alarm.at > 5000;
    lastAlarm.current = alarm.at;
    if (first) return; // alarme antigo de antes do recarregamento
    if (settings.som) playChime();
    if (settings.notificacao && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(alarm.title, { body: alarm.body, icon: "/icon.svg", tag: "medstudy-timer" });
      } catch {
        // alguns navegadores móveis não permitem notificação fora de service worker
      }
    }
  }, [alarm, settings.som, settings.notificacao]);

  useEffect(() => {
    if (baseTitle.current === null) baseTitle.current = document.title;
    if (active) document.title = `${formatClock(display)} · ${label} — MedStudy Hub`;
    else if (baseTitle.current) document.title = baseTitle.current;
  }, [active, display, label]);
}

/** Botão flutuante em todas as telas: mostra o tempo e abre o painel do timer. */
export function FocusTimerWidget() {
  const pathname = usePathname() ?? "";
  const { state, display, progress, isBreak } = useTimerView();
  const panelOpen = useFocusTimerStore((s) => s.panelOpen);
  const setPanelOpen = useFocusTimerStore((s) => s.setPanelOpen);
  const running = state.status === "running";
  const active = state.status !== "idle";
  const phaseLabel = state.mode === "pomodoro" ? PHASE_LABEL[state.phase] : state.mode === "cronometro" ? "Cronômetro" : "Timer";
  useTimerSideEffects(display, running, phaseLabel);

  if (pathname.startsWith("/foco")) return null;

  return (
    <div className={cn("fixed left-4 bottom-20 lg:bottom-6 lg:left-[272px]", panelOpen ? "z-[60]" : "z-40")}>
      {panelOpen && (
        <div className="absolute bottom-14 left-0 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface/95 backdrop-blur shadow-lift p-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
              <Timer size={15} className="text-primary" /> Timer de estudo
            </p>
            <div className="flex items-center gap-1">
              <Link href="/foco" onClick={() => setPanelOpen(false)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover" title="Modo foco em tela cheia">
                <Maximize2 size={14} />
              </Link>
              <button type="button" onClick={() => setPanelOpen(false)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover" aria-label="Fechar timer">
                <X size={15} />
              </button>
            </div>
          </div>
          <FocusTimerCore />
        </div>
      )}
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className={cn(
          "group relative inline-flex items-center gap-2 rounded-full border bg-surface/95 backdrop-blur shadow-lift pl-1.5 pr-3.5 py-1.5 transition-colors",
          running ? (isBreak ? "border-success/50" : "border-primary/60") : "border-border hover:border-primary/40"
        )}
        aria-label="Abrir timer de estudo"
        title="Timer de estudo (Pomodoro, cronômetro)"
      >
        <span className="relative h-9 w-9">
          <Ring progress={active ? progress : 0} size={36} stroke={3} isBreak={isBreak} running={running} />
          <span className="absolute inset-0 flex items-center justify-center">
            {isBreak ? <Coffee size={14} className="text-success" /> : <Timer size={14} className={running ? "text-primary" : "text-muted-foreground"} />}
          </span>
        </span>
        {active ? (
          <span className="flex flex-col items-start leading-none">
            <span className="font-metric text-sm text-foreground tabular-nums">{formatClock(display)}</span>
            <span className={cn("text-[10px] mt-0.5", isBreak ? "text-success" : "text-primary")}>
              {state.status === "paused" ? "pausado" : phaseLabel.toLowerCase()}
            </span>
          </span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">Pomodoro</span>
        )}
        {running && <span className={cn("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full animate-pulse", isBreak ? "bg-success" : "bg-primary")} />}
      </button>
    </div>
  );
}

/** Controle compacto para dentro de uma sessão (player de aula, resolução de
 * questões): inicia/pausa o timer já vinculado ao conteúdo aberto. */
export function FocusTimerInline({ label, className }: { label?: string; className?: string }) {
  const { state, display, progress, isBreak } = useTimerView();
  const running = state.status === "running";
  const active = state.status !== "idle";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-surface pl-1 pr-1 py-0.5", running && (isBreak ? "border-success/50" : "border-primary/50"), className)}>
      <button
        type="button"
        onClick={() => {
          if (running) state.pause();
          else {
            if (label && state.status === "idle") state.setLabel(label);
            state.start(label);
          }
        }}
        className="relative h-7 w-7 inline-flex items-center justify-center"
        title={running ? "Pausar timer de estudo" : `Iniciar ${state.mode === "pomodoro" ? "Pomodoro" : state.mode === "timer" ? "timer" : "cronômetro"}${label ? ` — ${label}` : ""}`}
        aria-label={running ? "Pausar timer de estudo" : "Iniciar timer de estudo"}
      >
        <span className="absolute inset-0">
          <Ring progress={active ? progress : 0} size={28} stroke={2.5} isBreak={isBreak} running={running} />
        </span>
        {running ? <Pause size={11} className={isBreak ? "text-success" : "text-primary"} /> : <Play size={11} className="text-muted-foreground" />}
      </button>
      <button type="button" onClick={() => state.setPanelOpen(!state.panelOpen)} className="font-metric text-xs tabular-nums text-foreground pr-1.5" title="Abrir timer de estudo">
        {active ? formatClock(display) : "🍅"}
      </button>
    </span>
  );
}
