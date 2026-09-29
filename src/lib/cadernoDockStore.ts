"use client";

// Painel do Caderno "acoplado" à tela (questões e player de aula): fica aberto
// ao lado do conteúdo, sem modal, e recebe trechos enviados de qualquer lugar.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCadernoStore } from "./cadernoStore";
import type { NoteOrigin } from "./types";

const DEFAULT_TITLE = "Minhas anotações";

interface CadernoDockState {
  open: boolean;
  cadernoId: string | null;
  /** Origem do contexto atual (questão/aula) — usada no botão "Referenciar". */
  context: NoteOrigin | null;
  openDock: (cadernoId?: string) => void;
  closeDock: () => void;
  toggleDock: () => void;
  setCaderno: (id: string) => void;
  setContext: (origin: NoteOrigin | null) => void;
}

export const useCadernoDockStore = create<CadernoDockState>()(
  persist(
    (set, get) => ({
      open: false,
      cadernoId: null,
      context: null,
      openDock: (cadernoId) => set({ open: true, cadernoId: cadernoId ?? get().cadernoId ?? ensureCaderno() }),
      closeDock: () => set({ open: false }),
      toggleDock: () => (get().open ? set({ open: false }) : get().openDock()),
      setCaderno: (id) => set({ cadernoId: id }),
      setContext: (origin) => set({ context: origin }),
    }),
    { name: "medstudy-hub-caderno-dock", partialize: (s) => ({ open: s.open, cadernoId: s.cadernoId }) }
  )
);

/** Caderno de destino: o do painel, senão o último usado, senão cria "Minhas anotações". */
export function ensureCaderno(): string {
  const dock = useCadernoDockStore.getState();
  const cadernos = useCadernoStore.getState();
  const existing =
    (dock.cadernoId && cadernos.cadernos.find((c) => c.id === dock.cadernoId)?.id) ||
    (cadernos.lastUsedId && cadernos.cadernos.find((c) => c.id === cadernos.lastUsedId)?.id) ||
    cadernos.cadernos[0]?.id;
  return existing ?? cadernos.createCaderno(DEFAULT_TITLE).id;
}

/** Envia um trecho (ex.: texto selecionado numa questão) ao caderno do painel e abre o painel. */
export function sendToCaderno(texto: string, origin?: NoteOrigin) {
  const id = ensureCaderno();
  useCadernoStore.getState().appendEntry(id, texto, origin);
  useCadernoDockStore.setState({ open: true, cadernoId: id });
}
