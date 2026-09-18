"use client";

// ============================================================================
// Hooks de acesso ao conteúdo — usados pelas páginas em vez de importar a
// store diretamente, para manter um único ponto de entrada.
// ============================================================================

import { useMemo } from "react";
import { useContentStore } from "./contentStore";
import { getSubjectsFromItems } from "./subjects";

export function useContent() {
  return useContentStore((s) => s.items);
}

export function useSubjects() {
  const items = useContentStore((s) => s.items);
  return useMemo(() => getSubjectsFromItems(items), [items]);
}
