// ============================================================================
// Filtros de questões — compartilhados entre a biblioteca, o Modo Estudo e o
// Modo Prova, para que os mesmos parâmetros de busca sempre produzam o
// mesmo conjunto de questões nas três telas.
// ============================================================================

import { needsReview } from "./questionProgressStore";
import type { Question, QuestionProgress } from "./types";
import { normalizeText } from "./utils";

export interface QuestionFilters {
  q?: string;
  disciplina?: string;
  banca?: string;
  ano?: string;
  dificuldade?: string;
  status?: string; // nao_respondida | acertada | errada
  favoritos?: boolean;
  modo?: "revisao";
}

export function filterQuestions(
  questions: Question[],
  filters: QuestionFilters,
  progressMap: Record<string, QuestionProgress>
): Question[] {
  const q = filters.q ? normalizeText(filters.q) : "";

  return questions.filter((question) => {
    if (filters.modo === "revisao") {
      const progress = progressMap[question.id];
      if (!progress || !needsReview(progress)) return false;
    }

    if (q) {
      const haystack = normalizeText(`${question.enunciado} ${question.tema ?? ""} ${question.tags.join(" ")}`);
      if (!haystack.includes(q)) return false;
    }

    if (filters.disciplina && filters.disciplina !== "todas" && question.subjectSlug !== filters.disciplina) {
      return false;
    }

    if (filters.banca && filters.banca !== "todas" && question.banca !== filters.banca) return false;

    if (filters.ano && filters.ano !== "todos" && String(question.ano ?? "") !== filters.ano) return false;

    if (filters.dificuldade && filters.dificuldade !== "todas" && String(question.dificuldade) !== filters.dificuldade) {
      return false;
    }

    if (filters.status && filters.status !== "todos") {
      const progress = progressMap[question.id];
      const status = progress?.status ?? "nao_respondida";
      if (status !== filters.status) return false;
    }

    if (filters.favoritos && !progressMap[question.id]?.favorite) return false;

    return true;
  });
}

export function getDistinctBancas(questions: Question[]): string[] {
  return Array.from(new Set(questions.map((q) => q.banca).filter((b): b is string => Boolean(b)))).sort();
}

export function getDistinctYears(questions: Question[]): number[] {
  return Array.from(new Set(questions.map((q) => q.ano).filter((a): a is number => Boolean(a)))).sort((a, b) => b - a);
}
