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
