"use client";

// ============================================================================
// Configuração do cronograma adaptativo (spec v2, seção 4) — persistida em
// localStorage. O plano em si (a distribuição dia a dia) NUNCA é persistido:
// é sempre recalculado a partir do conteúdo/questões pendentes no momento,
// então concluir um item antes ou depois do previsto já "recalcula
// automaticamente" o plano na próxima renderização, de graça.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDaysIso, todayIso } from "./dateUtil";

interface ScheduleConfig {
  active: boolean;
  selectedSubjects: string[];
  targetDate: string; // ISO date
  dailyMinutes: number;
}

interface ScheduleStoreState {
  config: ScheduleConfig;
  /** item key -> data ISO a partir da qual ele pode voltar a ser agendado. */
  postponed: Record<string, string>;

  setConfig: (config: ScheduleConfig) => void;
  deactivate: () => void;
  postponeItem: (key: string) => void;
  clearPostponement: (key: string) => void;
}

const DEFAULT_CONFIG: ScheduleConfig = {
  active: false,
  selectedSubjects: [],
  targetDate: addDaysIso(todayIso(), 30),
  dailyMinutes: 120,
};

export const useScheduleStore = create<ScheduleStoreState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      postponed: {},

      setConfig: (config) => set({ config }),
      deactivate: () => set((s) => ({ config: { ...s.config, active: false } })),

      postponeItem: (key) =>
        set((s) => {
          const current = s.postponed[key] ?? todayIso();
          return { postponed: { ...s.postponed, [key]: addDaysIso(current, 1) } };
        }),

      clearPostponement: (key) =>
        set((s) => {
          const next = { ...s.postponed };
          delete next[key];
          return { postponed: next };
        }),
    }),
    { name: "medstudy-hub-schedule" }
  )
);
