"use client";

// ============================================================================
// Marcações de texto (grifos) sobre enunciado/alternativas de questões —
// 4 cores fixas (amarelo, rosa, verde, ciano), persistidas em localStorage.
// Guardamos intervalos [start, end) sobre o texto puro, não HTML — quem
// renderiza (HighlightableText) que recorta o texto em spans na hora.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seededHash } from "./utils";
import type { Highlight, HighlightColor } from "./types";

interface HighlightStoreState {
  highlights: Highlight[];
  addHighlight: (questionId: string, field: Highlight["field"], start: number, end: number, color: HighlightColor) => void;
  removeHighlight: (id: string) => void;
  clearForQuestion: (questionId: string) => void;
}

export const useHighlightStore = create<HighlightStoreState>()(
  persist(
    (set) => ({
      highlights: [],

      addHighlight: (questionId, field, start, end, color) =>
        set((s) => ({
          highlights: [
            ...s.highlights,
            {
              id: `hl-${seededHash(`${questionId}-${field}-${start}-${end}-${Date.now()}-${Math.random()}`)}`,
              questionId,
              field,
              start,
              end,
              color,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      removeHighlight: (id) => set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),

      clearForQuestion: (questionId) => set((s) => ({ highlights: s.highlights.filter((h) => h.questionId !== questionId) })),
    }),
    { name: "medstudy-hub-highlights" }
  )
);
