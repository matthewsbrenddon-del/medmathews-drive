"use client";

// ============================================================================
// Banco de questões — persistido em localStorage, mesma filosofia do
// contentStore: dados de demonstração até a primeira importação; depois,
// upsert por `id` a cada nova planilha (nunca duplica, nunca perde o
// progresso do usuário em QuestionProgressStore).
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_QUESTIONS } from "./mockQuestions";
import type { ImportSummary, Question } from "./types";

interface QuestionStoreState {
  questions: Question[];
  hasImported: boolean;
  lastImport?: ImportSummary;
  /** true depois que o banco de questões real (seed-data/questions-qbank.json) foi buscado com sucesso. */
  seedHydrated: boolean;

  importQuestions: (newQuestions: Question[], summary: ImportSummary) => void;
  resetToDemo: () => void;
  /** Busca o banco de questões real (400 questões Revalida/INEP) uma vez, no cliente.
   * Só substitui os exemplos didáticos — nunca sobrescreve uma planilha que o usuário já importou. */
  hydrateSeed: () => Promise<void>;
}

export const useQuestionStore = create<QuestionStoreState>()(
  persist(
    (set, get) => ({
      questions: DEMO_QUESTIONS,
      hasImported: false,
      lastImport: undefined,
      seedHydrated: false,

      importQuestions: (newQuestions, summary) =>
        set((s) => {
          if (!s.hasImported) {
            return { questions: newQuestions, hasImported: true, lastImport: summary };
          }
          const byId = new Map(s.questions.map((q) => [q.id, q]));
          for (const q of newQuestions) byId.set(q.id, q);
          return { questions: Array.from(byId.values()), hasImported: true, lastImport: summary };
        }),

      resetToDemo: () => set({ questions: DEMO_QUESTIONS, hasImported: false, lastImport: undefined, seedHydrated: false }),

      hydrateSeed: async () => {
        if (get().seedHydrated || get().hasImported) return;
        try {
          const res = await fetch("/seed-data/questions-qbank.json");
          if (!res.ok) return;
          const seedQuestions: Question[] = await res.json();
          if (get().seedHydrated || get().hasImported) return;
          set({ questions: seedQuestions, seedHydrated: true });
        } catch {
          // Sem rede ou arquivo indisponível — mantém os exemplos didáticos, sem quebrar a UI.
        }
      },
    }),
    { name: "medstudy-hub-questions", partialize: (s) => ({ questions: s.questions, hasImported: s.hasImported, lastImport: s.lastImport, seedHydrated: s.seedHydrated }) }
  )
);
