"use client";

// ============================================================================
// Overrides manuais de classificação (tela de classificação em lote e
// importação da planilha de taxonomia) — persistidos em localStorage.
//
// Deliberadamente pequeno: a sugestão automática (classification.ts) é
// recalculada sob demanda a partir do caminho original, nunca persistida —
// só a escolha explícita do usuário (ou da planilha de taxonomia) vive aqui,
// por isso o armazenamento fica leve mesmo com ~13,6 mil itens no acervo.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ManualClassification {
  subjectSlug: string;
  disciplina?: string;
  subtema?: string;
  source: "manual" | "planilha";
}

interface ClassificationStoreState {
  /** Por ID do arquivo do Drive (LibraryFile.id). */
  overrides: Record<string, ManualClassification>;

  setOverride: (fileId: string, entry: ManualClassification) => void;
  setOverridesBulk: (entries: Record<string, ManualClassification>) => void;
  clearOverride: (fileId: string) => void;
  resetAll: () => void;
}

export const useClassificationStore = create<ClassificationStoreState>()(
  persist(
    (set) => ({
      overrides: {},

      setOverride: (fileId, entry) => set((s) => ({ overrides: { ...s.overrides, [fileId]: entry } })),

      setOverridesBulk: (entries) => set((s) => ({ overrides: { ...s.overrides, ...entries } })),

      clearOverride: (fileId) =>
        set((s) => {
          const next = { ...s.overrides };
          delete next[fileId];
          return { overrides: next };
        }),

      resetAll: () => set({ overrides: {} }),
    }),
    { name: "medstudy-hub-classification" }
  )
);
