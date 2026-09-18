"use client";

// ============================================================================
// Progresso do usuário no banco de questões — persistido em localStorage,
// indexado por `questionId` (nunca pelo enunciado). Implementa a revisão
// espaçada simples da spec v2 seção 3: uma questão errada entra na fila de
// revisão e só sai depois de 2 acertos seguidos.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestionProgress, QuestionStatus } from "./types";

interface QuestionProgressState {
  progress: Record<string, QuestionProgress>;

  getProgress: (questionId: string) => QuestionProgress;
  answerQuestion: (questionId: string, selected: string, correctLetter: string) => boolean;
  toggleFavorite: (questionId: string) => void;
  resetAll: () => void;
}

function empty(questionId: string): QuestionProgress {
  return { questionId, status: "nao_respondida", correctStreak: 0, favorite: false, history: [] };
}

export const useQuestionProgressStore = create<QuestionProgressState>()(
  persist(
    (set, get) => ({
      progress: {},

      getProgress: (questionId) => get().progress[questionId] ?? empty(questionId),

      answerQuestion: (questionId, selected, correctLetter) => {
        const correct = selected === correctLetter;
        set((s) => {
          const current = s.progress[questionId] ?? empty(questionId);
          const status: QuestionStatus = correct ? "acertada" : "errada";
          const correctStreak = correct ? current.correctStreak + 1 : 0;
          return {
            progress: {
              ...s.progress,
              [questionId]: {
                ...current,
                status,
                correctStreak,
                lastAnsweredAt: new Date().toISOString(),
                history: [...current.history, { answeredAt: new Date().toISOString(), selected, correct }],
              },
            },
          };
        });
        return correct;
      },

      toggleFavorite: (questionId) =>
        set((s) => {
          const current = s.progress[questionId] ?? empty(questionId);
          return { progress: { ...s.progress, [questionId]: { ...current, favorite: !current.favorite } } };
        }),

      resetAll: () => set({ progress: {} }),
    }),
    { name: "medstudy-hub-question-progress" }
  )
);

/** Uma questão está "dominada" (sai da fila de revisão) após 2 acertos seguidos. */
export function isMastered(progress: QuestionProgress): boolean {
  return progress.correctStreak >= 2;
}

/** Fila de revisão: questões já respondidas ao menos uma vez erradas e ainda não dominadas. */
export function needsReview(progress: QuestionProgress): boolean {
  return progress.status === "errada" && !isMastered(progress);
}
