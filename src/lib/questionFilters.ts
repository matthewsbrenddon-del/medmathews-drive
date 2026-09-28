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
  /** nao_respondida | resolvidas | acertada | errada | marcadas */
  status?: string;
  favoritos?: boolean;
  excluirAnuladas?: boolean;
  ordem?: QuestionOrder;
  modo?: "revisao";
}

export type QuestionOrder = "padrao" | "recentes" | "area" | "dificuldade" | "nunca_primeiro";

export const ORDER_LABELS: Record<QuestionOrder, string> = {
  padrao: "Ordem do banco",
  recentes: "Mais recentes",
  area: "Grande Área / tema",
  dificuldade: "Mais difíceis primeiro",
  nunca_primeiro: "Nunca respondidas primeiro",
};

export const STATUS_TABS: { id: string; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "nao_respondida", label: "Não resolvidas" },
  { id: "resolvidas", label: "Resolvidas" },
  { id: "acertada", label: "Acertei" },
  { id: "errada", label: "Errei" },
  { id: "marcadas", label: "Marcadas" },
];

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
      if (filters.status === "resolvidas") {
        if (status === "nao_respondida") return false;
      } else if (filters.status === "marcadas") {
        if (!progress?.marked) return false;
      } else if (status !== filters.status) return false;
    }

    if (filters.excluirAnuladas && question.anulada) return false;

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

/** Ordenação da lista (aplicada depois do filtro). Sempre estável. */
export function sortQuestions(
  list: Question[],
  ordem: QuestionOrder | undefined,
  progressMap: Record<string, QuestionProgress>
): Question[] {
  if (!ordem || ordem === "padrao") return list;
  const copy = [...list];
  if (ordem === "recentes") copy.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
  if (ordem === "area")
    copy.sort(
      (a, b) =>
        a.subjectName.localeCompare(b.subjectName, "pt-BR") || (a.tema ?? "").localeCompare(b.tema ?? "", "pt-BR")
    );
  if (ordem === "dificuldade") copy.sort((a, b) => b.dificuldade - a.dificuldade);
  if (ordem === "nunca_primeiro") {
    const answered = (q: Question) => (progressMap[q.id]?.history.length ?? 0) > 0;
    copy.sort((a, b) => Number(answered(a)) - Number(answered(b)));
  }
  return copy;
}

const PARAM_KEYS = ["q", "disciplina", "tema", "subtema", "banca", "ano", "dificuldade", "status", "ordem"] as const;

/** Filtros → query string (mesmos parâmetros em /questoes, /questoes/estudo e /questoes/prova). */
export function filtersToParams(filters: QuestionFilters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const key of PARAM_KEYS) {
    const value = filters[key];
    if (value && !["todas", "todos", "padrao"].includes(String(value))) params.set(key, String(value));
  }
  if (filters.tags && filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters.favoritos) params.set("favoritos", "1");
  if (filters.excluirAnuladas) params.set("excluirAnuladas", "1");
  if (filters.modo) params.set("modo", filters.modo);
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return params.toString();
}

export function paramsToFilters(params: URLSearchParams): QuestionFilters {
  const tags = params.get("tags");
  const filters: QuestionFilters = {
    tags: tags ? tags.split(",") : undefined,
    favoritos: params.get("favoritos") === "1" || undefined,
    excluirAnuladas: params.get("excluirAnuladas") === "1" || undefined,
    modo: params.get("modo") === "revisao" ? "revisao" : undefined,
  };
  for (const key of PARAM_KEYS) {
    const value = params.get(key);
    if (value) (filters as Record<string, string>)[key] = value;
  }
  return filters;
}

export interface FilterChip {
  key: keyof QuestionFilters | `tag:${string}`;
  label: string;
}

/** Filtros aplicados como chips removíveis ("Cardiologia ×", "Errei ×"). */
export function describeFilters(filters: QuestionFilters, subjectName: (slug: string) => string): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.disciplina && filters.disciplina !== "todas") chips.push({ key: "disciplina", label: subjectName(filters.disciplina) });
  if (filters.tema && filters.tema !== "todos") chips.push({ key: "tema", label: filters.tema });
  if (filters.subtema && filters.subtema !== "todos") chips.push({ key: "subtema", label: filters.subtema });
  if (filters.banca && filters.banca !== "todas") chips.push({ key: "banca", label: filters.banca });
  if (filters.ano && filters.ano !== "todos") chips.push({ key: "ano", label: filters.ano });
  if (filters.dificuldade && filters.dificuldade !== "todas") chips.push({ key: "dificuldade", label: `Dificuldade ${filters.dificuldade}` });
  if (filters.status && filters.status !== "todos")
    chips.push({ key: "status", label: STATUS_TABS.find((t) => t.id === filters.status)?.label ?? filters.status });
  for (const tag of filters.tags ?? []) chips.push({ key: `tag:${tag}`, label: `#${tag}` });
  if (filters.favoritos) chips.push({ key: "favoritos", label: "Favoritas" });
  if (filters.excluirAnuladas) chips.push({ key: "excluirAnuladas", label: "Sem anuladas" });
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”` });
  return chips;
}

export function removeFilterChip(filters: QuestionFilters, key: FilterChip["key"]): QuestionFilters {
  if (typeof key === "string" && key.startsWith("tag:")) {
    const tag = key.slice(4);
    return { ...filters, tags: (filters.tags ?? []).filter((t) => t !== tag) };
  }
  const next = { ...filters };
  delete next[key as keyof QuestionFilters];
  if (key === "disciplina") {
    delete next.tema;
    delete next.subtema;
  }
  if (key === "tema") delete next.subtema;
  return next;
}
