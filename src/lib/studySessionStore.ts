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
  addSession: (kind: StudySession["kind"], startedAt: string, endedAt: string) => void;
}

export const useStudySessionStore = create<StudySessionStoreState>()(
  persist(
    (set) => ({
      sessions: [],

      addSession: (kind, startedAt, endedAt) => {
        const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
        if (durationSeconds < 3) return; // sessões residuais (abrir e sair na hora) não contam
        set((s) => ({
          sessions: [
            ...s.sessions,
            { id: `sess-${seededHash(`${kind}-${startedAt}-${Math.random()}`)}`, kind, startedAt, endedAt, durationSeconds },
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

export function sumDurationSeconds(sessions: StudySession[], range: TimeRangeFilter, now?: Date): number {
  const start = rangeStartIso(range, now);
  return sessions
    .filter((s) => !start || s.startedAt >= start)
    .reduce((acc, s) => acc + s.durationSeconds, 0);
}

/** Soma horas líquidas dentro de um período arbitrário (filtro "Período selecionável"). */
export function sumDurationSecondsInRange(sessions: StudySession[], startIso: string, endIsoExclusive: string): number {
  return sessions
    .filter((s) => s.startedAt >= startIso && s.startedAt < endIsoExclusive)
    .reduce((acc, s) => acc + s.durationSeconds, 0);
}

export const STUDY_KIND_LABELS: Record<StudySession["kind"], string> = {
  estudo: "Questões (Banco/Cadernos)",
  simulado: "Simulado",
  flashcards: "Flashcards",
  quiz: "Quizzes com IA",
};
