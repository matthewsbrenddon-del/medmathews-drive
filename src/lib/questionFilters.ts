// ============================================================================
// Filtros de questões — compartilhados entre a biblioteca, o Modo Estudo e o
// Modo Prova, para que os mesmos parâmetros de busca sempre produzam o
// mesmo conjunto de questões nas três telas. Suporta a montagem de uma
// sessão altamente personalizável: disciplina, tema, subtema, tags
// (todas precisam estar presentes na questão), banca, ano, dificuldade e
// status (feita ou não).
// ============================================================================

import { needsReview } from "./questionProgressStore";
import type { Question, QuestionProgress } from "./types";
import { normalizeText } from "./utils";

export interface QuestionFilters {
  q?: string;
  disciplina?: string;
  tema?: string;
  subtema?: string;
  /** Tags exigidas — uma questão só entra se tiver TODAS as tags selecionadas. */
  tags?: string[];
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
  const wantedTags = (filters.tags ?? []).map((t) => normalizeText(t)).filter(Boolean);

  return questions.filter((question) => {
    if (filters.modo === "revisao") {
      const progress = progressMap[question.id];
      if (!progress || !needsReview(progress)) return false;
    }

    if (q) {
      const haystack = normalizeText(
        `${question.enunciado} ${question.tema ?? ""} ${question.subtema ?? ""} ${question.tags.join(" ")}`
      );
      if (!haystack.includes(q)) return false;
    }

    if (filters.disciplina && filters.disciplina !== "todas" && question.subjectSlug !== filters.disciplina) {
      return false;
    }

    if (filters.tema && filters.tema !== "todos" && question.tema !== filters.tema) return false;

    if (filters.subtema && filters.subtema !== "todos" && question.subtema !== filters.subtema) return false;

    if (wantedTags.length > 0) {
      const questionTags = question.tags.map((t) => normalizeText(t));
      if (!wantedTags.every((t) => questionTags.includes(t))) return false;
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

export function getDistinctTemas(questions: Question[], subjectSlug?: string): string[] {
  return Array.from(
    new Set(
      questions
        .filter((q) => !subjectSlug || subjectSlug === "todas" || q.subjectSlug === subjectSlug)
        .map((q) => q.tema)
        .filter((t): t is string => Boolean(t))
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getDistinctSubtemas(questions: Question[], tema?: string): string[] {
  return Array.from(
    new Set(
      questions
        .filter((q) => !tema || tema === "todos" || q.tema === tema)
        .map((q) => q.subtema)
        .filter((t): t is string => Boolean(t))
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getDistinctTags(questions: Question[]): string[] {
  const set = new Set<string>();
  for (const q of questions) for (const tag of q.tags) set.add(tag);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
