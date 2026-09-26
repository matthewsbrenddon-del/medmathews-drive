"use client";

// ============================================================================
// Cadernos — coleções nomeadas de questões, livres de disciplina/tema
// (ex.: "Revisão da véspera", "Erros recorrentes de ECG") — persistidas em
// localStorage, indexadas por questionId (nunca por enunciado).
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seededHash } from "./utils";
import type { Notebook } from "./types";

interface NotebookStoreState {
  notebooks: Notebook[];
  /** notebookId -> lista de questionId */
  entries: Record<string, string[]>;

  createNotebook: (name: string) => Notebook;
  renameNotebook: (id: string, name: string) => void;
  deleteNotebook: (id: string) => void;
  addQuestion: (notebookId: string, questionId: string) => void;
  removeQuestion: (notebookId: string, questionId: string) => void;
  isInNotebook: (notebookId: string, questionId: string) => boolean;
}

export const useNotebookStore = create<NotebookStoreState>()(
  persist(
    (set, get) => ({
      notebooks: [],
      entries: {},

      createNotebook: (name) => {
        const notebook: Notebook = {
          id: `notebook-${seededHash(`${name}-${Date.now()}-${Math.random()}`)}`,
          name,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ notebooks: [...s.notebooks, notebook], entries: { ...s.entries, [notebook.id]: [] } }));
        return notebook;
      },

      renameNotebook: (id, name) =>
        set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, name } : n)) })),

      deleteNotebook: (id) =>
        set((s) => {
          const entries = { ...s.entries };
          delete entries[id];
          return { notebooks: s.notebooks.filter((n) => n.id !== id), entries };
        }),

      addQuestion: (notebookId, questionId) =>
        set((s) => {
          const current = s.entries[notebookId] ?? [];
          if (current.includes(questionId)) return s;
          return { entries: { ...s.entries, [notebookId]: [...current, questionId] } };
        }),

      removeQuestion: (notebookId, questionId) =>
        set((s) => ({
          entries: { ...s.entries, [notebookId]: (s.entries[notebookId] ?? []).filter((id) => id !== questionId) },
        })),

      isInNotebook: (notebookId, questionId) => (get().entries[notebookId] ?? []).includes(questionId),
    }),
    { name: "medstudy-hub-notebooks" }
  )
);
