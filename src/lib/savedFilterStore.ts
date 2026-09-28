"use client";

// Filtros de questões salvos com nome (ex.: "Cardiologia — só as que errei"),
// reabertos com um clique ou disparados como "simulado relâmpago".

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestionFilters } from "./questionFilters";
import { seededHash } from "./utils";

export interface SavedFilter {
  id: string;
  nome: string;
  filters: QuestionFilters;
  criadoEm: string;
}

interface SavedFilterState {
  saved: SavedFilter[];
  saveFilter: (nome: string, filters: QuestionFilters) => SavedFilter;
  updateFilter: (id: string, filters: QuestionFilters) => void;
  deleteFilter: (id: string) => void;
}

export const useSavedFilterStore = create<SavedFilterState>()(
  persist(
    (set) => ({
      saved: [],
      saveFilter: (nome, filters) => {
        const item: SavedFilter = {
          id: `filtro-${seededHash(`${nome}-${Date.now()}-${Math.random()}`)}`,
          nome: nome.trim() || "Meu filtro",
          filters,
          criadoEm: new Date().toISOString(),
        };
        set((s) => ({ saved: [...s.saved, item] }));
        return item;
      },
      updateFilter: (id, filters) => set((s) => ({ saved: s.saved.map((f) => (f.id === id ? { ...f, filters } : f)) })),
      deleteFilter: (id) => set((s) => ({ saved: s.saved.filter((f) => f.id !== id) })),
    }),
    { name: "medstudy-hub-saved-filters" }
  )
);
