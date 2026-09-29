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
import type { Highlight, HighlightColor, HighlightStyle } from "./types";

interface HighlightStoreState {
  highlights: Highlight[];
  addHighlight: (
    questionId: string,
    field: Highlight["field"],
    start: number,
    end: number,
    color: HighlightColor,
    style?: HighlightStyle
  ) => void;
  /** Remove as marcações que tocam o intervalo [start, end) do campo. */
  clearRange: (questionId: string, field: Highlight["field"], start: number, end: number) => void;
  removeHighlight: (id: string) => void;
  clearForQuestion: (questionId: string) => void;
}

export const useHighlightStore = create<HighlightStoreState>()(
  persist(
    (set) => ({
      highlights: [],

      addHighlight: (questionId, field, start, end, color, style = "marca") =>
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
              style,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      clearRange: (questionId, field, start, end) =>
        set((s) => ({
          highlights: s.highlights.filter(
            (h) => !(h.questionId === questionId && h.field === field && h.start < end && h.end > start)
          ),
        })),

      removeHighlight: (id) => set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),

      clearForQuestion: (questionId) => set((s) => ({ highlights: s.highlights.filter((h) => h.questionId !== questionId) })),
    }),
    { name: "medstudy-hub-highlights" }
  )
);
