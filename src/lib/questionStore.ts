"use client";

// ============================================================================
// Banco de questões.
//
// - Banco oficial (public/seed-data/questions-qbank.json, ~5.000 questões,
//   ~6,6 MB): buscado do servidor uma vez por sessão (o navegador faz cache)
//   e mantido só em memória — grande demais para o localStorage.
// - Questões do próprio aluno (planilhas importadas em Configurações e
//   questões salvas pelos Quizzes com IA): persistidas em localStorage,
//   sobrepõem o banco oficial por `id` (upsert — nunca duplica).
//
// Progresso, grifos e listas ficam em outras stores, sempre por questionId.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_QUESTIONS } from "./mockQuestions";
import type { ImportSummary, Question } from "./types";

type SeedStatus = "idle" | "loading" | "ready" | "error";

interface QuestionStoreState {
  /** Banco completo em uso (oficial + do aluno). */
  questions: Question[];
  seedQuestions: Question[];
  customQuestions: Question[];
  seedStatus: SeedStatus;
  hasImported: boolean;
  lastImport?: ImportSummary;

  importQuestions: (newQuestions: Question[], summary: ImportSummary) => void;
  resetToDemo: () => void;
  hydrateSeed: () => Promise<void>;
}

function merge(seed: Question[], custom: Question[], status: SeedStatus): Question[] {
  if (seed.length === 0) return custom.length > 0 || status !== "error" ? custom : DEMO_QUESTIONS;
  if (custom.length === 0) return seed;
  const byId = new Map(seed.map((q) => [q.id, q]));
  for (const q of custom) byId.set(q.id, q);
  return Array.from(byId.values());
}

export const useQuestionStore = create<QuestionStoreState>()(
  persist(
    (set, get) => ({
      questions: [],
      seedQuestions: [],
      customQuestions: [],
      seedStatus: "idle",
      hasImported: false,
      lastImport: undefined,

      importQuestions: (newQuestions, summary) =>
        set((s) => {
          const byId = new Map(s.customQuestions.map((q) => [q.id, q]));
          for (const q of newQuestions) byId.set(q.id, q);
          const customQuestions = Array.from(byId.values());
          return {
            customQuestions,
            questions: merge(s.seedQuestions, customQuestions, s.seedStatus),
            hasImported: true,
            lastImport: summary,
          };
        }),

      resetToDemo: () =>
        set((s) => ({
          customQuestions: [],
          questions: merge(s.seedQuestions, [], s.seedStatus),
          hasImported: false,
          lastImport: undefined,
        })),

      hydrateSeed: async () => {
        if (get().seedStatus === "loading" || get().seedStatus === "ready") return;
        set({ seedStatus: "loading" });
        try {
          const res = await fetch("/seed-data/questions-qbank.json");
          if (!res.ok) throw new Error(String(res.status));
          const seedQuestions: Question[] = await res.json();
          set((s) => ({ seedQuestions, seedStatus: "ready", questions: merge(seedQuestions, s.customQuestions, "ready") }));
        } catch {
          // Sem rede: mantém as questões do aluno (ou os exemplos didáticos), sem quebrar a UI.
          set((s) => ({ seedStatus: "error", questions: merge([], s.customQuestions, "error") }));
        }
      },
    }),
    {
      name: "medstudy-hub-questions",
      version: 2,
      partialize: (s) => ({ customQuestions: s.customQuestions, hasImported: s.hasImported, lastImport: s.lastImport }),
      // v1 gravava o banco inteiro (seed incluído) em `questions`; agora só as do aluno.
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as { questions?: Question[]; customQuestions?: Question[]; hasImported?: boolean; lastImport?: ImportSummary };
        if (version < 2) {
          const customQuestions = (old.questions ?? []).filter((q) => !q.id.startsWith("qbank-") && !q.id.startsWith("demo-q-"));
          return { customQuestions, hasImported: Boolean(old.hasImported) && customQuestions.length > 0, lastImport: old.lastImport };
        }
        return { customQuestions: old.customQuestions ?? [], hasImported: Boolean(old.hasImported), lastImport: old.lastImport };
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<QuestionStoreState>;
        const customQuestions = p.customQuestions ?? [];
        return { ...current, ...p, customQuestions, questions: merge(current.seedQuestions, customQuestions, current.seedStatus) };
      },
    }
  )
);

/** true quando o banco oficial já chegou (ou falhou) — antes disso, telas que
 * montam listas de questões devem mostrar carregamento, não "nenhuma questão". */
export function useQuestionsReady(): boolean {
  return useQuestionStore((s) => s.seedStatus === "ready" || s.seedStatus === "error");
}
