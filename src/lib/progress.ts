// ============================================================================
// Funções puras de agregação de progresso — combinam o catálogo de conteúdo
// (DriveFile + classificação) com o estado do usuário (UserFileState) para
// produzir os números mostrados no Dashboard, em Disciplinas e em Progresso.
// ============================================================================

import { KNOWN_SUBJECTS } from "./classify";
import type { StudyContent, UserFileState } from "./types";

export type UserStateMap = Record<string, UserFileState>;

export interface SubjectProgress {
  slug: string;
  name: string;
  colorToken: string;
  icon: string;
  totalLessons: number;
  watchedLessons: number;
  totalMaterials: number;
  studiedMaterials: number;
  totalItems: number;
  completedItems: number;
  percent: number;
}

function isComplete(item: StudyContent, state?: UserFileState): boolean {
  if (!state) return false;
  if (item.kind === "videoaula") return state.watchStatus === "assistida";
  return state.readStatus === "estudado";
}

function isInProgress(item: StudyContent, state?: UserFileState): boolean {
  if (!state) return false;
  if (item.kind === "videoaula") return state.watchStatus === "em_andamento";
  return state.readStatus === "acessado";
}

export function computeSubjectProgress(content: StudyContent[], userStates: UserStateMap): SubjectProgress[] {
  const bySubject = new Map<string, StudyContent[]>();
  for (const item of content) {
    const list = bySubject.get(item.subjectSlug) ?? [];
    list.push(item);
    bySubject.set(item.subjectSlug, list);
  }

  const result: SubjectProgress[] = [];
  for (const [slug, items] of bySubject.entries()) {
    const meta = KNOWN_SUBJECTS.find((s) => s.slug === slug);
    const lessons = items.filter((i) => i.kind === "videoaula");
    const materials = items.filter((i) => i.kind !== "videoaula");
    const watchedLessons = lessons.filter((i) => isComplete(i, userStates[i.fileId])).length;
    const studiedMaterials = materials.filter((i) => isComplete(i, userStates[i.fileId])).length;
    const totalItems = items.length;
    const completedItems = watchedLessons + studiedMaterials;
    result.push({
      slug,
      name: meta?.name ?? slug,
      colorToken: meta?.colorToken ?? "215 16% 47%",
      icon: meta?.icon ?? "BookOpen",
      totalLessons: lessons.length,
      watchedLessons,
      totalMaterials: materials.length,
      studiedMaterials,
      totalItems,
      completedItems,
      percent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export interface OverallProgress {
  percent: number;
  totalLessons: number;
  watchedLessons: number;
  totalMaterials: number;
  studiedMaterials: number;
  totalStudySeconds: number;
}

export function computeOverallProgress(content: StudyContent[], userStates: UserStateMap): OverallProgress {
  const lessons = content.filter((i) => i.kind === "videoaula");
  const materials = content.filter((i) => i.kind !== "videoaula");
  const watchedLessons = lessons.filter((i) => isComplete(i, userStates[i.fileId]));
  const studiedMaterials = materials.filter((i) => isComplete(i, userStates[i.fileId]));
  const totalStudySeconds = watchedLessons.reduce((acc, i) => acc + (i.durationSeconds ?? 0), 0);
  const totalItems = content.length;
  const completedItems = watchedLessons.length + studiedMaterials.length;

  return {
    percent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    totalLessons: lessons.length,
    watchedLessons: watchedLessons.length,
    totalMaterials: materials.length,
    studiedMaterials: studiedMaterials.length,
    totalStudySeconds,
  };
}

export function getContinueStudying(content: StudyContent[], userStates: UserStateMap, limit = 3): StudyContent[] {
  return content
    .filter((item) => {
      const state = userStates[item.fileId];
      return state && (isInProgress(item, state) || (item.kind === "videoaula" && state.watchStatus === "em_andamento"));
    })
    .sort((a, b) => {
      const da = userStates[a.fileId]?.lastViewedAt ?? "";
      const db = userStates[b.fileId]?.lastViewedAt ?? "";
      return db.localeCompare(da);
    })
    .slice(0, limit);
}

export function getRecentlyViewed(content: StudyContent[], userStates: UserStateMap, limit = 6): StudyContent[] {
  return content
    .filter((item) => userStates[item.fileId]?.lastViewedAt)
    .sort((a, b) => {
      const da = userStates[a.fileId]?.lastViewedAt ?? "";
      const db = userStates[b.fileId]?.lastViewedAt ?? "";
      return db.localeCompare(da);
    })
    .slice(0, limit);
}

export function itemProgressPercent(item: StudyContent, userStates: UserStateMap): number {
  return userStates[item.fileId]?.progressPercent ?? 0;
}
