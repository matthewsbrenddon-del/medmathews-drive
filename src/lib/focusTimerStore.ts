"use client";

// ============================================================================
// Timer de estudo — Pomodoro, cronômetro (conta para cima) e timer (contagem
// regressiva). Persistido com timestamps, então continua certo ao trocar de
// tela, recarregar a página ou voltar depois de um tempo com a aba fechada.
//
// Cada trecho de foco (do "iniciar" até pausar/terminar) vira uma sessão
// "foco" no studySessionStore — entra nas horas líquidas de Meu Progresso
// (sem contar em dobro o tempo que coincide com uma sessão de questões) e
// aparece na Agenda.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStudySessionStore } from "./studySessionStore";

export type TimerMode = "pomodoro" | "cronometro" | "timer";
export type PomodoroPhase = "foco" | "pausa" | "pausa_longa";
export type TimerStatus = "idle" | "running" | "paused";

export interface FocusSettings {
  focoMin: number;
  pausaMin: number;
  pausaLongaMin: number;
  ciclosAteLonga: number;
  timerMin: number;
  /** Começa a próxima fase sozinho ao terminar a atual. */
  autoIniciar: boolean;
  som: boolean;
  notificacao: boolean;
}

export const PHASE_LABEL: Record<PomodoroPhase, string> = { foco: "Foco", pausa: "Pausa curta", pausa_longa: "Pausa longa" };

interface FocusTimerState {
  mode: TimerMode;
  phase: PomodoroPhase;
  status: TimerStatus;
  /** Início (epoch ms) do trecho rodando agora. */
  runStartedAt: number | null;
  /** Tempo já acumulado em trechos anteriores (pausas no meio). */
  accumulatedMs: number;
  /** Focos concluídos no ciclo atual (para a pausa longa). */
  ciclos: number;
  /** Focos concluídos hoje (contador visível). */
  focosHoje: { date: string; count: number };
  label: string;
  settings: FocusSettings;
  /** Último alarme disparado — o widget toca som/notificação quando muda. */
  alarm: { at: number; title: string; body: string } | null;
  panelOpen: boolean;

  setMode: (mode: TimerMode) => void;
  setLabel: (label: string) => void;
  setSettings: (patch: Partial<FocusSettings>) => void;
  setPanelOpen: (open: boolean) => void;
  start: (label?: string) => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  /** Chamado pelo relógio: encerra a fase se o tempo acabou. */
  tick: (now?: number) => void;
}

const DEFAULT_SETTINGS: FocusSettings = {
  focoMin: 25,
  pausaMin: 5,
  pausaLongaMin: 15,
  ciclosAteLonga: 4,
  timerMin: 50,
  autoIniciar: false,
  som: true,
  notificacao: true,
};

const today = () => new Date().toISOString().slice(0, 10);

export function targetMs(state: Pick<FocusTimerState, "mode" | "phase" | "settings">): number | null {
  if (state.mode === "cronometro") return null;
  if (state.mode === "timer") return state.settings.timerMin * 60_000;
  const min = state.phase === "foco" ? state.settings.focoMin : state.phase === "pausa" ? state.settings.pausaMin : state.settings.pausaLongaMin;
  return min * 60_000;
}

export function elapsedMs(state: Pick<FocusTimerState, "status" | "runStartedAt" | "accumulatedMs">, now = Date.now()): number {
  return state.accumulatedMs + (state.status === "running" && state.runStartedAt ? now - state.runStartedAt : 0);
}

/** Este trecho conta como estudo? (pausas do Pomodoro não contam) */
function isStudyRun(state: Pick<FocusTimerState, "mode" | "phase">) {
  return state.mode !== "pomodoro" || state.phase === "foco";
}

function recordRun(state: FocusTimerState, endMs: number) {
  if (!state.runStartedAt || !isStudyRun(state)) return;
  useStudySessionStore
    .getState()
    .addSession("foco", new Date(state.runStartedAt).toISOString(), new Date(endMs).toISOString(), state.label.trim() || undefined);
}

export const useFocusTimerStore = create<FocusTimerState>()(
  persist(
    (set, get) => ({
      mode: "pomodoro",
      phase: "foco",
      status: "idle",
      runStartedAt: null,
      accumulatedMs: 0,
      ciclos: 0,
      focosHoje: { date: today(), count: 0 },
      label: "",
      settings: DEFAULT_SETTINGS,
      alarm: null,
      panelOpen: false,

      setMode: (mode) => {
        const s = get();
        if (s.status === "running") recordRun(s, Date.now());
        set({ mode, phase: "foco", status: "idle", runStartedAt: null, accumulatedMs: 0 });
      },
      setLabel: (label) => set({ label }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setPanelOpen: (panelOpen) => set({ panelOpen }),

      start: (label) => {
        const s = get();
        if (s.status === "running") return;
        set({ status: "running", runStartedAt: Date.now(), ...(label !== undefined && !s.label.trim() ? { label } : {}) });
      },

      pause: () => {
        const s = get();
        if (s.status !== "running" || !s.runStartedAt) return;
        const now = Date.now();
        recordRun(s, now);
        set({ status: "paused", accumulatedMs: s.accumulatedMs + (now - s.runStartedAt), runStartedAt: null });
      },

      reset: () => {
        const s = get();
        if (s.status === "running") recordRun(s, Date.now());
        set({ status: "idle", runStartedAt: null, accumulatedMs: 0 });
      },

      skip: () => {
        const s = get();
        if (s.status === "running") recordRun(s, Date.now());
        if (s.mode !== "pomodoro") {
          set({ status: "idle", runStartedAt: null, accumulatedMs: 0 });
          return;
        }
        const nextPhase: PomodoroPhase = s.phase === "foco" ? ((s.ciclos + 1) % s.settings.ciclosAteLonga === 0 ? "pausa_longa" : "pausa") : "foco";
        set({ phase: nextPhase, status: "idle", runStartedAt: null, accumulatedMs: 0 });
      },

      tick: (now = Date.now()) => {
        const s = get();
        if (s.status !== "running" || !s.runStartedAt) return;
        const target = targetMs(s);
        if (target === null) return;
        const elapsed = elapsedMs(s, now);
        if (elapsed < target) return;

        // O trecho termina exatamente quando o tempo acabou (mesmo se a aba estava fechada).
        const endAt = s.runStartedAt + (target - s.accumulatedMs);
        recordRun(s, endAt);

        if (s.mode === "timer") {
          set({
            status: "idle",
            runStartedAt: null,
            accumulatedMs: 0,
            alarm: { at: now, title: "Tempo esgotado", body: `${s.settings.timerMin} min de estudo concluídos${s.label ? ` — ${s.label}` : ""}.` },
          });
          return;
        }

        const d = today();
        let { ciclos, focosHoje } = s;
        let nextPhase: PomodoroPhase;
        let body: string;
        if (s.phase === "foco") {
          ciclos += 1;
          focosHoje = { date: d, count: (focosHoje.date === d ? focosHoje.count : 0) + 1 };
          nextPhase = ciclos % s.settings.ciclosAteLonga === 0 ? "pausa_longa" : "pausa";
          body = nextPhase === "pausa_longa" ? `Ótimo! ${ciclos} focos seguidos — pausa longa de ${s.settings.pausaLongaMin} min.` : `Pausa de ${s.settings.pausaMin} min. Levante, beba água.`;
        } else {
          nextPhase = "foco";
          body = `Bora: ${s.settings.focoMin} min de foco${s.label ? ` em ${s.label}` : ""}.`;
        }
        const auto = s.settings.autoIniciar;
        set({
          ciclos: nextPhase === "foco" && s.phase === "pausa_longa" ? 0 : ciclos,
          focosHoje,
          phase: nextPhase,
          status: auto ? "running" : "idle",
          runStartedAt: auto ? now : null,
          accumulatedMs: 0,
          alarm: { at: now, title: s.phase === "foco" ? "Foco concluído! 🍅" : "Fim da pausa", body },
        });
      },
    }),
    {
      name: "medstudy-hub-focus-timer",
      version: 1,
      partialize: (s) => ({
        mode: s.mode,
        phase: s.phase,
        status: s.status,
        runStartedAt: s.runStartedAt,
        accumulatedMs: s.accumulatedMs,
        ciclos: s.ciclos,
        focosHoje: s.focosHoje,
        label: s.label,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FocusTimerState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
    }
  )
);

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Bipe curto via Web Audio (sem arquivo de som). */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22, 0.44].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = [660, 880, 990][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // sem áudio disponível
  }
}
