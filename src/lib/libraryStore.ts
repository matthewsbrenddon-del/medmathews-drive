"use client";

// ============================================================================
// Biblioteca completa — carregada uma única vez por sessão a partir de
// public/seed-data/library-mapeamento.json (~13,6 mil arquivos, ~2,3 MB).
// Não persistido em localStorage (grande demais e é dado de referência
// estático, não estado editável do usuário) — cada aba busca uma vez e o
// navegador cuida do cache HTTP nas próximas.
// ============================================================================

import { create } from "zustand";
import type { LibraryFile } from "./types";

interface LibraryStoreState {
  files: LibraryFile[];
  status: "idle" | "loading" | "ready" | "error";
  hydrate: () => Promise<void>;
}

export const useLibraryStore = create<LibraryStoreState>()((set, get) => ({
  files: [],
  status: "idle",

  hydrate: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    try {
      const res = await fetch("/seed-data/library-mapeamento.json");
      if (!res.ok) throw new Error(String(res.status));
      const files: LibraryFile[] = await res.json();
      set({ files, status: "ready" });
    } catch {
      set({ status: "error" });
    }
  },
}));
