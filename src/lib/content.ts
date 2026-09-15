"use client";

// ============================================================================
// Fonte de conteúdo — abstrai "de onde vêm os arquivos".
//
// Hoje: sempre os dados de demonstração (src/lib/mockData.ts).
// Em produção, quando GOOGLE_CLIENT_ID/SECRET e DATABASE_URL estiverem
// configurados (ver .env.example), troque `useContent()` para buscar em
// `/api/drive/tree`, que por sua vez usa `fetchRealDriveTree()` de
// src/lib/driveClient.ts. O formato (`StudyContent[]`) é o mesmo nos dois
// casos, então nenhuma página precisa mudar.
// ============================================================================

import { useMemo } from "react";
import { DEMO_CONTENT, getDemoSubjects } from "./mockData";
import type { StudyContent } from "./types";

export function useContent(): StudyContent[] {
  return useMemo(() => DEMO_CONTENT, []);
}

export function useSubjects() {
  return useMemo(() => getDemoSubjects(), []);
}
