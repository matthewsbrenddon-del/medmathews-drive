// ============================================================================
// Agregação de estatísticas do banco de questões — alimenta a página Meu
// Progresso (spec v2, seção 3: "% de acerto por disciplina/tema").
// ============================================================================

import { resolveSubject } from "./subjects";
import type { Question, QuestionProgress } from "./types";

export interface SubjectQuestionStats {
  slug: string;
  name: string;
  colorToken: string;
  total: number;
  answered: number;
  correct: number;
  accuracyPercent: number;
}

export interface OverallQuestionStats {
  total: number;
  answered: number;
  correct: number;
  accuracyPercent: number;
}

export function computeQuestionStats(
  questions: Question[],
  progressMap: Record<string, QuestionProgress>
): { overall: OverallQuestionStats; bySubject: SubjectQuestionStats[] } {
  const bySubjectMap = new Map<string, SubjectQuestionStats>();
  let totalAnswered = 0;
  let totalCorrect = 0;

  for (const question of questions) {
    const subject = resolveSubject(question.subjectName);
    const entry =
      bySubjectMap.get(subject.slug) ??
      ({ slug: subject.slug, name: subject.name, colorToken: subject.colorToken, total: 0, answered: 0, correct: 0, accuracyPercent: 0 } as SubjectQuestionStats);

    entry.total += 1;
    const progress = progressMap[question.id];
    if (progress && progress.history.length > 0) {
      entry.answered += 1;
      const lastCorrect = progress.history[progress.history.length - 1].correct;
      if (lastCorrect) entry.correct += 1;
      totalAnswered += 1;
      if (lastCorrect) totalCorrect += 1;
    }

    bySubjectMap.set(subject.slug, entry);
  }

  const bySubject = Array.from(bySubjectMap.values())
    .map((s) => ({ ...s, accuracyPercent: s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0 }))
    .filter((s) => s.answered > 0)
    .sort((a, b) => b.answered - a.answered);

  return {
    overall: {
      total: questions.length,
      answered: totalAnswered,
      correct: totalCorrect,
      accuracyPercent: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
    },
    bySubject,
  };
}

export interface TemaRecommendation {
  tema: string;
  subjectSlug: string;
  subjectName: string;
  colorToken: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
}

/**
 * Diagnóstico de pontos fracos: para cada tema com pelo menos uma questão
 * respondida, calcula o % de acerto (considerando a resposta mais recente
 * de cada questão) e devolve os temas com pior desempenho primeiro — a
 * base da seção "Temas recomendados para treino" em /questoes.
 */
export function getRecommendedTemas(
  questions: Question[],
  progressMap: Record<string, QuestionProgress>,
  limit = 5
): TemaRecommendation[] {
  const byTema = new Map<string, TemaRecommendation>();

  for (const question of questions) {
    if (!question.tema) continue;
    const progress = progressMap[question.id];
    if (!progress || progress.history.length === 0) continue;

    const subject = resolveSubject(question.subjectName);
    const key = `${subject.slug}::${question.tema}`;
    const entry =
      byTema.get(key) ??
      ({
        tema: question.tema,
        subjectSlug: subject.slug,
        subjectName: subject.name,
        colorToken: subject.colorToken,
        answered: 0,
        correct: 0,
        accuracyPercent: 0,
      } satisfies TemaRecommendation);

    entry.answered += 1;
    const lastCorrect = progress.history[progress.history.length - 1].correct;
    if (lastCorrect) entry.correct += 1;
    byTema.set(key, entry);
  }

  return Array.from(byTema.values())
    .map((t) => ({ ...t, accuracyPercent: Math.round((t.correct / t.answered) * 100) }))
    .filter((t) => t.accuracyPercent < 100)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent || b.answered - a.answered)
    .slice(0, limit);
}
