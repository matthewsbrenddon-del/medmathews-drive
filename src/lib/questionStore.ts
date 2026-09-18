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

  importQuestions: (newQuestions: Question[], summary: ImportSummary) => void;
  resetToDemo: () => void;
}

export const useQuestionStore = create<QuestionStoreState>()(
  persist(
    (set) => ({
      questions: DEMO_QUESTIONS,
      hasImported: false,
      lastImport: undefined,

      importQuestions: (newQuestions, summary) =>
        set((s) => {
          if (!s.hasImported) {
            return { questions: newQuestions, hasImported: true, lastImport: summary };
          }
          const byId = new Map(s.questions.map((q) => [q.id, q]));
          for (const q of newQuestions) byId.set(q.id, q);
          return { questions: Array.from(byId.values()), hasImported: true, lastImport: summary };
        }),

      resetToDemo: () => set({ questions: DEMO_QUESTIONS, hasImported: false, lastImport: undefined }),
    }),
    { name: "medstudy-hub-questions" }
  )
);
