"use client";

// ============================================================================
// Biblioteca de conteúdo — persistida em localStorage (zustand persist).
//
// Antes da primeira importação, mostra os dados de demonstração
// (src/lib/mockData.ts). A primeira planilha importada SUBSTITUI os dados de
// demonstração pelo conteúdo real; importações seguintes fazem upsert por
// `fileId` (nunca duplicam, nunca perdem itens que não vieram na nova
// planilha) — ver spec v2 seção 1 e 2.
//
// Em produção (DATABASE_URL configurado), esta store seria trocada por
// chamadas a uma API que persiste em Content (Prisma) — a forma dos dados
// (`StudyContent[]`) é a mesma, então nenhuma tela precisaria mudar.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_CONTENT } from "./mockData";
import type { ImportSummary, StudyContent } from "./types";

interface ContentStoreState {
  items: StudyContent[];
  hasImported: boolean;
  lastImport?: ImportSummary;

  /** Aplica uma planilha importada: substitui a demo na primeira vez, faz upsert por fileId depois. */
  importItems: (newItems: StudyContent[], summary: ImportSummary) => void;
  resetToDemo: () => void;
}

export const useContentStore = create<ContentStoreState>()(
  persist(
    (set) => ({
      items: DEMO_CONTENT,
      hasImported: false,
      lastImport: undefined,

      importItems: (newItems, summary) =>
        set((s) => {
          if (!s.hasImported) {
            return { items: newItems, hasImported: true, lastImport: summary };
          }
          const byId = new Map(s.items.map((item) => [item.fileId, item]));
          for (const item of newItems) byId.set(item.fileId, item);
          return { items: Array.from(byId.values()), hasImported: true, lastImport: summary };
        }),

      resetToDemo: () => set({ items: DEMO_CONTENT, hasImported: false, lastImport: undefined }),
    }),
    { name: "medstudy-hub-content" }
  )
);
