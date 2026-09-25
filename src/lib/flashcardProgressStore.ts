"use client";

// ============================================================================
// Progresso de revisão dos flashcards — repetição espaçada simples estilo
// Leitner (5 caixas). Lembrou -> sobe de caixa e o intervalo até a próxima
// revisão aumenta; esqueceu -> volta para a caixa 1 e o cartão fica devido
// de novo imediatamente. Persistido em localStorage, indexado por cardId.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDaysIso, todayIso } from "./dateUtil";
import type { Flashcard, FlashcardProgress } from "./types";

const BOX_INTERVAL_DAYS = [0, 0, 1, 3, 7, 16]; // índice = caixa (1-5); caixa 1 = devido hoje

function empty(cardId: string): FlashcardProgress {
  return { cardId, box: 1, dueDate: todayIso(), reviewCount: 0 };
}

interface FlashcardProgressState {
  progress: Record<string, FlashcardProgress>;

  getProgress: (cardId: string) => FlashcardProgress;
  reviewCard: (cardId: string, remembered: boolean) => void;
  isDue: (cardId: string) => boolean;
  resetAll: () => void;
}

export const useFlashcardProgressStore = create<FlashcardProgressState>()(
  persist(
    (set, get) => ({
      progress: {},

      getProgress: (cardId) => get().progress[cardId] ?? empty(cardId),

      reviewCard: (cardId, remembered) =>
        set((s) => {
          const current = s.progress[cardId] ?? empty(cardId);
          const box = remembered ? Math.min(5, current.box + 1) : 1;
          const dueDate = addDaysIso(todayIso(), BOX_INTERVAL_DAYS[box]);
          return {
            progress: {
              ...s.progress,
              [cardId]: { ...current, box, dueDate, lastReviewedAt: new Date().toISOString(), reviewCount: current.reviewCount + 1 },
            },
          };
        }),

      isDue: (cardId) => {
        const p = get().progress[cardId];
        if (!p) return true;
        return p.dueDate <= todayIso();
      },

      resetAll: () => set({ progress: {} }),
    }),
    { name: "medstudy-hub-flashcard-progress" }
  )
);

export function getDueCards(cards: Flashcard[], progressMap: Record<string, FlashcardProgress>): Flashcard[] {
  const today = todayIso();
  return cards.filter((c) => {
    const p = progressMap[c.id];
    return !p || p.dueDate <= today;
  });
}
