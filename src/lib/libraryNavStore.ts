"use client";

// Posição de navegação em Disciplinas (visão, pasta aberta e pastas expandidas
// na árvore) — ao voltar para a biblioteca, o aluno reencontra onde parou.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LibraryView } from "./library";

interface LibraryNavState {
  view: LibraryView;
  pathByView: Record<LibraryView, string[]>;
  expandedByView: Record<LibraryView, string[]>;
  setView: (view: LibraryView) => void;
  setPath: (view: LibraryView, path: string[]) => void;
  toggleExpanded: (view: LibraryView, key: string, open?: boolean) => void;
  expandMany: (view: LibraryView, keys: string[]) => void;
}

export const useLibraryNavStore = create<LibraryNavState>()(
  persist(
    (set) => ({
      view: "area",
      pathByView: { area: [], tema: [], curso: [] },
      expandedByView: { area: [], tema: [], curso: [] },
      setView: (view) => set({ view }),
      setPath: (view, path) => set((s) => ({ pathByView: { ...s.pathByView, [view]: path } })),
      toggleExpanded: (view, key, open) =>
        set((s) => {
          const current = new Set(s.expandedByView[view]);
          const shouldOpen = open ?? !current.has(key);
          if (shouldOpen) current.add(key);
          else current.delete(key);
          return { expandedByView: { ...s.expandedByView, [view]: Array.from(current) } };
        }),
      expandMany: (view, keys) =>
        set((s) => ({
          expandedByView: { ...s.expandedByView, [view]: Array.from(new Set([...s.expandedByView[view], ...keys])) },
        })),
    }),
    {
      name: "medstudy-hub-library-nav",
      // Estados salvos antes da visão "tema" não têm essa chave.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LibraryNavState>;
        return {
          ...current,
          ...p,
          pathByView: { ...current.pathByView, ...(p.pathByView ?? {}) },
          expandedByView: { ...current.expandedByView, ...(p.expandedByView ?? {}) },
        };
      },
    }
  )
);
