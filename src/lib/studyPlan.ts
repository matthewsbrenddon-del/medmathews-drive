// ============================================================================
// Cronograma adaptativo (spec v2, seção 4) — função pura que distribui
// aulas, materiais e blocos de questões pendentes entre os dias disponíveis
// até a data-alvo, respeitando prioridade, tempo estimado de cada item, e
// o que já foi concluído.
//
// Puramente derivado do estado atual (nunca persistido) — por isso o plano
// se "recalcula automaticamente" a cada render, sem nenhum job em segundo
// plano: assim que o usuário conclui um item (em qualquer tela do app), ele
// some do próximo cálculo do plano.
// ============================================================================

import { needsReview } from "./questionProgressStore";
import { addDaysIso, diffInDays, todayIso } from "./dateUtil";
import type { ContentProgress, Question, QuestionProgress, StudyContent } from "./types";

const QUESTION_BLOCK_SIZE = 10;
const MINUTES_PER_QUESTION = 1.5;
const DEFAULT_MATERIAL_MINUTES = 20;
const MAX_PLAN_DAYS = 120;

export interface PlanItem {
  key: string;
  kind: "conteudo" | "questoes";
  title: string;
  subjectSlug: string;
  subjectName: string;
  estimatedMinutes: number;
  priority: number;
  content?: StudyContent;
  questionSubjectSlug?: string;
  questionCount?: number;
}

export interface PlanDay {
  date: string;
  items: PlanItem[];
  totalMinutes: number;
  budgetMinutes: number;
}

export interface StudyPlan {
  days: PlanDay[];
  overflow: PlanItem[];
  totalPendingMinutes: number;
}

function isContentComplete(item: StudyContent, progress?: ContentProgress): boolean {
  if (!progress) return false;
  return item.kind === "videoaula" ? progress.watchStatus === "assistida" : progress.readStatus === "estudado";
}

function estimateContentMinutes(item: StudyContent): number {
  if (item.durationSeconds) return Math.max(1, Math.ceil(item.durationSeconds / 60));
  return DEFAULT_MATERIAL_MINUTES;
}

export function buildStudyPlan(params: {
  selectedSubjects: string[];
  targetDate: string;
  dailyMinutes: number;
  content: StudyContent[];
  contentProgress: Record<string, ContentProgress>;
  questions: Question[];
  questionProgress: Record<string, QuestionProgress>;
  postponed: Record<string, string>;
}): StudyPlan {
  const { selectedSubjects, targetDate, dailyMinutes, content, contentProgress, questions, questionProgress, postponed } =
    params;

  const subjectSet = new Set(selectedSubjects);
  const today = todayIso();

  // 1) Itens de conteúdo pendentes.
  const items: PlanItem[] = content
    .filter((c) => subjectSet.has(c.subjectSlug) && !isContentComplete(c, contentProgress[c.fileId]))
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => ({
      key: `conteudo:${c.fileId}`,
      kind: "conteudo" as const,
      title: c.displayTitle,
      subjectSlug: c.subjectSlug,
      subjectName: c.subjectName,
      estimatedMinutes: estimateContentMinutes(c),
      priority: c.priority,
      content: c,
    }));

  // 2) Blocos de questões pendentes (não respondidas ou ainda não dominadas
  // na revisão), agrupados por disciplina.
  const pendingBySubject = new Map<string, { subjectName: string; reviewing: number; fresh: number }>();
  for (const q of questions) {
    if (!subjectSet.has(q.subjectSlug) || q.anulada) continue;
    const progress = questionProgress[q.id];
    const isPending = !progress || progress.status === "nao_respondida" || needsReview(progress);
    if (!isPending) continue;
    const entry = pendingBySubject.get(q.subjectSlug) ?? { subjectName: q.subjectName, reviewing: 0, fresh: 0 };
    if (progress && needsReview(progress)) entry.reviewing += 1;
    else entry.fresh += 1;
    pendingBySubject.set(q.subjectSlug, entry);
  }

  for (const [slug, { subjectName, reviewing, fresh }] of pendingBySubject.entries()) {
    const total = reviewing + fresh;
    const blocks = Math.ceil(total / QUESTION_BLOCK_SIZE);
    for (let b = 0; b < blocks; b++) {
      const count = Math.min(QUESTION_BLOCK_SIZE, total - b * QUESTION_BLOCK_SIZE);
      const isReviewBlock = b * QUESTION_BLOCK_SIZE < reviewing;
      items.push({
        key: `questoes:${slug}:${b}`,
        kind: "questoes",
        title: isReviewBlock
          ? `Revisão de questões erradas — ${subjectName}`
          : `Bloco de questões — ${subjectName}`,
        subjectSlug: slug,
        subjectName,
        estimatedMinutes: Math.round(count * MINUTES_PER_QUESTION),
        priority: isReviewBlock ? 4 : 3,
        questionSubjectSlug: slug,
        questionCount: count,
      });
    }
  }

  // 3) Ordena por prioridade (spec) — desempate por menor tempo estimado,
  // para preencher os dias com mais eficiência.
  items.sort((a, b) => b.priority - a.priority || a.estimatedMinutes - b.estimatedMinutes);

  // 4) Data de início de cada item (respeitando "adiar").
  const totalDays = Math.max(1, Math.min(MAX_PLAN_DAYS, diffInDays(today, targetDate) + 1));
  const earliestDayIndex = items.map((item) => {
    const postponedTo = postponed[item.key];
    if (!postponedTo) return 0;
    return Math.max(0, diffInDays(today, postponedTo));
  });

  const placed = new Array(items.length).fill(false);
  const days: PlanDay[] = [];

  for (let d = 0; d < totalDays; d++) {
    let budget = dailyMinutes;
    const dayItems: PlanItem[] = [];
    for (let i = 0; i < items.length; i++) {
      if (placed[i]) continue;
      if (earliestDayIndex[i] > d) continue;
      if (items[i].estimatedMinutes <= budget) {
        dayItems.push(items[i]);
        placed[i] = true;
        budget -= items[i].estimatedMinutes;
      }
    }
    days.push({ date: addDaysIso(today, d), items: dayItems, totalMinutes: dailyMinutes - budget, budgetMinutes: dailyMinutes });
  }

  const overflow = items.filter((_, i) => !placed[i]);
  const totalPendingMinutes = items.reduce((acc, i) => acc + i.estimatedMinutes, 0);

  return { days, overflow, totalPendingMinutes };
}
