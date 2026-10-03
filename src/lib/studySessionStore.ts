"use client";

// ============================================================================
// Cronômetro de sessões de estudo (Quizzes, Simulado, Flashcards) — alimenta
// "horas líquidas de estudo" em Meu Progresso, filtrável por período.
// Cada sessão é um intervalo consolidado (início/fim), gravado quando a
// sessão termina — nada é medido em tempo real além do cronômetro na tela.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seededHash } from "./utils";
import type { StudySession } from "./types";

interface StudySessionStoreState {
  sessions: StudySession[];
  addSession: (kind: StudySession["kind"], startedAt: string, endedAt: string, label?: string) => void;
}

export const useStudySessionStore = create<StudySessionStoreState>()(
  persist(
    (set) => ({
      sessions: [],

      addSession: (kind, startedAt, endedAt, label) => {
        const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
        if (durationSeconds < 3) return; // sessões residuais (abrir e sair na hora) não contam
        set((s) => ({
          sessions: [
            ...s.sessions,
            {
              id: `sess-${seededHash(`${kind}-${startedAt}-${Math.random()}`)}`,
              kind,
              startedAt,
              endedAt,
              durationSeconds,
              ...(label ? { label } : {}),
            },
          ],
        }));
      },
    }),
    { name: "medstudy-hub-study-sessions" }
  )
);

export type TimeRangeFilter = "24h" | "7d" | "30d" | "12m" | "todos";

/** Recorte inicial (ISO datetime) para cada filtro de período — `null` = sem recorte ("todos"). */
export function rangeStartIso(range: TimeRangeFilter, now: Date = new Date()): string | null {
  const d = new Date(now);
  switch (range) {
    case "24h":
      d.setHours(d.getHours() - 24);
      return d.toISOString();
    case "7d":
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    case "30d":
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    case "12m":
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString();
    case "todos":
      return null;
  }
}

/** Soma a UNIÃO dos intervalos — um Pomodoro rodando durante uma sessão de
 * questões não conta o mesmo minuto duas vezes nas horas líquidas. */
export function unionSeconds(sessions: StudySession[]): number {
  const intervals = sessions
    .map((s) => [new Date(s.startedAt).getTime(), new Date(s.endedAt).getTime()] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [a, b] of intervals) {
    if (a > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) curEnd = b;
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return Math.round(total / 1000);
}

export function sumDurationSeconds(sessions: StudySession[], range: TimeRangeFilter, now?: Date): number {
  const start = rangeStartIso(range, now);
  return unionSeconds(sessions.filter((s) => !start || s.startedAt >= start));
}

/** Soma horas líquidas dentro de um período arbitrário (filtro "Período selecionável"). */
export function sumDurationSecondsInRange(sessions: StudySession[], startIso: string, endIsoExclusive: string): number {
  return unionSeconds(sessions.filter((s) => s.startedAt >= startIso && s.startedAt < endIsoExclusive));
}

export const STUDY_KIND_LABELS: Record<StudySession["kind"], string> = {
  estudo: "Questões (Banco/Listas)",
  simulado: "Simulado",
  flashcards: "Flashcards",
  quiz: "Quizzes com IA",
  foco: "Pomodoro / cronômetro",
};
