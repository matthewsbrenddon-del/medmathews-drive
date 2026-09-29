"use client";

// ============================================================================
// Caderno — um texto longo por caderno (abordagem mais simples de manter:
// sem "entradas" separadas). Anotações vindas de questões/aulas/materiais são
// só trechos anexados ao fim do texto, com a referência de origem embutida
// como link markdown `origem:<tipo>:<id>` (ver src/lib/markdown.tsx).
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seededHash } from "./utils";
import type { Caderno, NoteOrigin } from "./types";

interface CadernoStoreState {
  cadernos: Caderno[];
  /** Último caderno usado — aberto por padrão no painel "Adicionar ao caderno". */
  lastUsedId: string | null;

  createCaderno: (titulo: string, conteudo?: string) => Caderno;
  renameCaderno: (id: string, titulo: string) => void;
  updateConteudo: (id: string, conteudo: string) => void;
  deleteCaderno: (id: string) => void;
  appendEntry: (id: string, texto: string, origem?: NoteOrigin) => void;
  touch: (id: string) => void;
}

export function originLink(origem: NoteOrigin): string {
  const label = origem.label.replace(/[[\]]/g, "");
  return `[via ${label}](origem:${origem.tipo}:${origem.id})`;
}

export const useCadernoStore = create<CadernoStoreState>()(
  persist(
    (set) => ({
      cadernos: [],
      lastUsedId: null,

      createCaderno: (titulo, conteudo = "") => {
        const now = new Date().toISOString();
        const caderno: Caderno = {
          id: `caderno-${seededHash(`${titulo}-${now}-${Math.random()}`)}`,
          titulo: titulo.trim() || "Sem título",
          conteudo,
          criadoEm: now,
          atualizadoEm: now,
        };
        set((s) => ({ cadernos: [caderno, ...s.cadernos], lastUsedId: caderno.id }));
        return caderno;
      },

      renameCaderno: (id, titulo) =>
        set((s) => ({
          cadernos: s.cadernos.map((c) =>
            c.id === id ? { ...c, titulo: titulo.trim() || "Sem título", atualizadoEm: new Date().toISOString() } : c
          ),
        })),

      updateConteudo: (id, conteudo) =>
        set((s) => ({
          cadernos: s.cadernos.map((c) => (c.id === id ? { ...c, conteudo, atualizadoEm: new Date().toISOString() } : c)),
          lastUsedId: id,
        })),

      deleteCaderno: (id) =>
        set((s) => ({
          cadernos: s.cadernos.filter((c) => c.id !== id),
          lastUsedId: s.lastUsedId === id ? null : s.lastUsedId,
        })),

      appendEntry: (id, texto, origem) =>
        set((s) => ({
          cadernos: s.cadernos.map((c) => {
            if (c.id !== id) return c;
            const bloco = [origem ? originLink(origem) : "", texto.trim()].filter(Boolean).join("\n");
            if (!bloco) return c;
            const conteudo = (c.conteudo.trim() ? `${c.conteudo.trimEnd()}\n\n---\n\n${bloco}` : bloco) + "\n";
            return { ...c, conteudo, atualizadoEm: new Date().toISOString() };
          }),
          lastUsedId: id,
        })),

      touch: (id) => set({ lastUsedId: id }),
    }),
    { name: "medstudy-hub-caderno" }
  )
);
