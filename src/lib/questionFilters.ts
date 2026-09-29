// ============================================================================
// Filtros de questões — compartilhados entre o banco, o Modo Estudo, o Modo
// Prova e a apostila em PDF, para que os mesmos parâmetros sempre produzam o
// mesmo conjunto de questões.
//
// Dois níveis:
// - Facetas multisseleção (QConcursos-like): grande área, especialidade,
//   tema, origem, prova, ano, dificuldade, características, meu histórico e
//   minhas listas. Dentro de uma faceta vale "OU"; entre facetas, "E"
//   (características e histórico usam "E" também dentro da faceta).
// - Campos simples antigos (disciplina, tema, subtema, banca, ano,
//   dificuldade) continuam aceitos — links antigos e a tela de Progresso
//   seguem funcionando.
// ============================================================================

import { needsReview } from "./questionProgressStore";
import { useNotebookStore } from "./notebookStore";
import type { Question, QuestionProgress } from "./types";
import { normalizeText } from "./utils";

export type FacetKey =
  | "areas"
  | "especialidades"
  | "temas"
  | "origens"
  | "provas"
  | "anos"
  | "dificuldades"
  | "caracteristicas"
  | "historico"
  | "listas";

export type SearchScope = "tudo" | "enunciado" | "alternativas" | "tema";

export interface QuestionFilters {
  q?: string;
  /** Onde procurar o texto de `q`. */
  escopo?: SearchScope;
  // --- facetas (multisseleção) ---
  areas?: string[];
  especialidades?: string[];
  temas?: string[];
  origens?: string[];
  provas?: string[];
  anos?: string[];
  dificuldades?: string[];
  caracteristicas?: string[];
  historico?: string[];
  listas?: string[];
  // --- campos simples (compatibilidade) ---
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

export const SCOPE_LABELS: Record<SearchScope, string> = {
  tudo: "Tudo",
  enunciado: "Enunciado",
  alternativas: "Alternativas",
  tema: "Tema / seção",
};

export const DIFICULDADE_LABELS: Record<string, string> = {
  "0": "Não classificada",
  "1": "Muito fácil",
  "2": "Fácil",
  "3": "Média",
  "4": "Difícil",
  "5": "Muito difícil",
};

export const CARACTERISTICA_LABELS: Record<string, string> = {
  sem_imagem: "Sem imagem",
  com_imagem: "Com imagem / ECG / tabela",
  com_comentario: "Com comentário",
  sem_anuladas: "Sem anuladas",
  so_anuladas: "Só anuladas",
  ia: "Geradas nos Quizzes com IA",
};

export const HISTORICO_LABELS: Record<string, string> = {
  nunca: "Nunca respondi",
  errei_ultima: "Errei na última tentativa",
  errei_2x: "Errei 2 vezes ou mais",
  revisao: "Na fila de revisão",
  favoritas: "Favoritas",
  marcadas: "Marcadas para revisar",
};

export const FACETS: { key: FacetKey; label: string; hint: string; searchable?: boolean; and?: boolean }[] = [
  { key: "areas", label: "Grande área", hint: "As 5 grandes áreas do ENAMED/Revalida" },
  { key: "especialidades", label: "Especialidade", hint: "Cardiologia, Nefrologia, Obstetrícia…", searchable: true },
  { key: "temas", label: "Tema / assunto", hint: "Assuntos específicos dentro de cada área", searchable: true },
  { key: "origens", label: "Banca / coleção", hint: "Revalida (INEP), coletâneas, suas importações" },
  { key: "provas", label: "Prova", hint: "Prova ou caderno de origem", searchable: true },
  { key: "anos", label: "Ano", hint: "Ano de aplicação da prova" },
  { key: "dificuldades", label: "Dificuldade", hint: "Estimada pela fonte" },
  { key: "caracteristicas", label: "Características", hint: "Imagem, comentário, anuladas…", and: true },
  { key: "historico", label: "Meu histórico", hint: "Com base nas suas respostas", and: true },
  { key: "listas", label: "Minhas listas", hint: "Listas de questões que você montou" },
];

const FACET_KEYS = FACETS.map((f) => f.key);

export interface FilterContext {
  /** notebookId -> questionIds (Minhas listas). */
  listEntries?: Record<string, string[]>;
}

function origemOf(q: Question): string {
  if (q.colecao) return q.colecao;
  if (q.banca) return q.banca;
  return q.origem === "ia" ? "Quizzes com IA" : "Minhas importações";
}

/** Valores de uma questão para cada faceta (usado no filtro e nas contagens). */
function facetValues(
  q: Question,
  key: FacetKey,
  progress: QuestionProgress | undefined,
  ctx: FilterContext
): string[] {
  switch (key) {
    case "areas":
      return [q.subjectSlug];
    case "especialidades":
      return q.especialidade ? [q.especialidade] : [q.subjectName];
    case "temas":
      return q.tema ? [q.tema] : [];
    case "origens":
      return [origemOf(q)];
    case "provas":
      return q.prova ? [q.prova] : [];
    case "anos":
      return [q.ano ? String(q.ano) : "0"];
    case "dificuldades":
      return [String(q.dificuldade || 0)];
    case "caracteristicas": {
      const out: string[] = [q.hasImage ? "com_imagem" : "sem_imagem"];
      if (q.comentario) out.push("com_comentario");
      out.push(q.anulada ? "so_anuladas" : "sem_anuladas");
      if (q.origem === "ia") out.push("ia");
      return out;
    }
    case "historico": {
      const out: string[] = [];
      const history = progress?.history ?? [];
      if (history.length === 0) out.push("nunca");
      if (history.length > 0 && !history[history.length - 1].correct) out.push("errei_ultima");
      if (history.filter((h) => !h.correct).length >= 2) out.push("errei_2x");
      if (progress && needsReview(progress)) out.push("revisao");
      if (progress?.favorite) out.push("favoritas");
      if (progress?.marked) out.push("marcadas");
      return out;
    }
    case "listas": {
      const out: string[] = [];
      for (const [id, ids] of Object.entries(ctx.listEntries ?? {})) if (ids.includes(q.id)) out.push(id);
      return out;
    }
  }
}

// ---------------------------------------------------------------------------
// Busca por texto: termos com E, "frase exata" entre aspas e -exclusão.
// ---------------------------------------------------------------------------

const haystackCache = new WeakMap<Question, Partial<Record<SearchScope, string>>>();

function haystack(q: Question, scope: SearchScope): string {
  let entry = haystackCache.get(q);
  if (!entry) {
    entry = {};
    haystackCache.set(q, entry);
  }
  const cached = entry[scope];
  if (cached !== undefined) return cached;
  const alternatives = q.alternatives.map((a) => a.text).join(" ");
  const tema = `${q.tema ?? ""} ${q.subtema ?? ""} ${q.secao ?? ""} ${q.especialidade ?? ""} ${q.tags.join(" ")}`;
  const raw =
    scope === "enunciado" ? q.enunciado : scope === "alternativas" ? alternatives : scope === "tema" ? tema : `${q.enunciado} ${alternatives} ${tema}`;
  const value = normalizeText(raw.replace(/\s+/g, " "));
  entry[scope] = value;
  return value;
}

interface ParsedQuery {
  include: string[];
  exclude: string[];
}

function parseQuery(raw: string): ParsedQuery {
  const include: string[] = [];
  const exclude: string[] = [];
  const re = /(-?)"([^"]+)"|(-?)(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const negative = (m[1] || m[3]) === "-";
    const term = normalizeText(m[2] ?? m[4] ?? "").trim();
    if (!term) continue;
    (negative ? exclude : include).push(term);
  }
  return { include, exclude };
}

// ---------------------------------------------------------------------------

function isAll(value: string | undefined, ...alls: string[]) {
  return !value || alls.includes(value);
}

function passesLegacy(question: Question, filters: QuestionFilters, progress: QuestionProgress | undefined): boolean {
  if (filters.modo === "revisao" && (!progress || !needsReview(progress))) return false;
  if (!isAll(filters.disciplina, "todas") && question.subjectSlug !== filters.disciplina) return false;
  if (!isAll(filters.tema, "todos") && question.tema !== filters.tema) return false;
  if (!isAll(filters.subtema, "todos") && question.subtema !== filters.subtema) return false;
  if (filters.tags && filters.tags.length > 0) {
    const questionTags = question.tags.map((t) => normalizeText(t));
    if (!filters.tags.every((t) => questionTags.includes(normalizeText(t)))) return false;
  }
  if (!isAll(filters.banca, "todas") && question.banca !== filters.banca) return false;
  if (!isAll(filters.ano, "todos") && String(question.ano ?? "") !== filters.ano) return false;
  if (!isAll(filters.dificuldade, "todas") && String(question.dificuldade) !== filters.dificuldade) return false;
  if (filters.status && filters.status !== "todos") {
    const status = progress?.status ?? "nao_respondida";
    if (filters.status === "resolvidas") {
      if (status === "nao_respondida") return false;
    } else if (filters.status === "marcadas") {
      if (!progress?.marked) return false;
    } else if (status !== filters.status) return false;
  }
  if (filters.excluirAnuladas && question.anulada) return false;
  if (filters.favoritos && !progress?.favorite) return false;
  return true;
}

function makeMatcher(
  filters: QuestionFilters,
  progressMap: Record<string, QuestionProgress>,
  ctx: FilterContext,
  skipFacet?: FacetKey
) {
  const parsed = filters.q ? parseQuery(filters.q) : { include: [], exclude: [] };
  const scope = filters.escopo ?? "tudo";
  const active = FACETS.filter((f) => f.key !== skipFacet && (filters[f.key]?.length ?? 0) > 0).map((f) => ({
    key: f.key,
    and: Boolean(f.and),
    values: new Set(filters[f.key]),
  }));

  return (question: Question) => {
    const progress = progressMap[question.id];
    if (!passesLegacy(question, filters, progress)) return false;
    if (parsed.include.length > 0 || parsed.exclude.length > 0) {
      const text = haystack(question, scope);
      if (!parsed.include.every((t) => text.includes(t))) return false;
      if (parsed.exclude.some((t) => text.includes(t))) return false;
    }
    for (const facet of active) {
      const values = facetValues(question, facet.key, progress, ctx);
      if (facet.and) {
        for (const wanted of Array.from(facet.values)) if (!values.includes(wanted)) return false;
      } else if (!values.some((v) => facet.values.has(v))) return false;
    }
    return true;
  };
}

function resolveContext(filters: QuestionFilters, ctx?: FilterContext): FilterContext {
  if (ctx?.listEntries || !(filters.listas?.length)) return ctx ?? {};
  return { listEntries: useNotebookStore.getState().entries };
}

export function filterQuestions(
  questions: Question[],
  filters: QuestionFilters,
  progressMap: Record<string, QuestionProgress>,
  ctx?: FilterContext
): Question[] {
  const match = makeMatcher(filters, progressMap, resolveContext(filters, ctx));
  return questions.filter(match);
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/**
 * Contagem por faceta: cada faceta é contada com todos os OUTROS filtros
 * aplicados (padrão de busca facetada) — o número ao lado de cada opção é
 * quantas questões você teria ao marcá-la.
 */
export function computeFacets(
  questions: Question[],
  filters: QuestionFilters,
  progressMap: Record<string, QuestionProgress>,
  ctx: FilterContext,
  labels: { area: (slug: string) => string; lista: (id: string) => string }
): Record<FacetKey, FacetOption[]> {
  const out = {} as Record<FacetKey, FacetOption[]>;
  for (const facet of FACETS) {
    const match = makeMatcher(filters, progressMap, ctx, facet.key);
    const counts = new Map<string, number>();
    for (const q of questions) {
      if (!match(q)) continue;
      for (const v of facetValues(q, facet.key, progressMap[q.id], ctx)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    // Opções já selecionadas continuam visíveis mesmo com contagem 0.
    for (const v of filters[facet.key] ?? []) if (!counts.has(v)) counts.set(v, 0);
    if (facet.key === "listas") for (const id of Object.keys(ctx.listEntries ?? {})) if (!counts.has(id)) counts.set(id, 0);

    const label = (v: string) => {
      switch (facet.key) {
        case "areas":
          return labels.area(v);
        case "anos":
          return v === "0" ? "Sem ano (coletâneas)" : v;
        case "dificuldades":
          return DIFICULDADE_LABELS[v] ?? v;
        case "caracteristicas":
          return CARACTERISTICA_LABELS[v] ?? v;
        case "historico":
          return HISTORICO_LABELS[v] ?? v;
        case "listas":
          return labels.lista(v);
        default:
          return v;
      }
    };

    let options = Array.from(counts.entries()).map(([value, count]) => ({ value, label: label(value), count }));
    if (facet.key === "anos") options.sort((a, b) => Number(b.value || 0) - Number(a.value || 0) || (a.value === "0" ? 1 : -1));
    else if (facet.key === "dificuldades") options.sort((a, b) => Number(a.value) - Number(b.value));
    else if (facet.key === "caracteristicas" || facet.key === "historico") {
      const order = Object.keys(facet.key === "caracteristicas" ? CARACTERISTICA_LABELS : HISTORICO_LABELS);
      options.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
      if (facet.key === "historico") options = options.filter((o) => o.count > 0 || (filters.historico ?? []).includes(o.value));
    } else options.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
    out[facet.key] = options;
  }
  return out;
}

export function getDistinctBancas(questions: Question[]): string[] {
  return Array.from(new Set(questions.map((q) => q.banca).filter((b): b is string => Boolean(b)))).sort();
}

export function getDistinctYears(questions: Question[]): number[] {
  return Array.from(new Set(questions.map((q) => q.ano).filter((a): a is number => Boolean(a)))).sort((a, b) => b - a);
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

/** PRNG determinístico (mulberry32) — o mesmo `seed` gera a mesma ordem
 * (sessão, "continuar de onde parei" e apostila batem entre si). */
export function seededShuffle<T>(list: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const PARAM_KEYS = ["q", "escopo", "disciplina", "tema", "subtema", "banca", "ano", "dificuldade", "status", "ordem"] as const;

/** Filtros → query string (mesmos parâmetros em /questoes, /questoes/estudo e /questoes/prova). */
export function filtersToParams(filters: QuestionFilters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const key of PARAM_KEYS) {
    const value = filters[key];
    if (value && !["todas", "todos", "padrao", "tudo"].includes(String(value))) params.set(key, String(value));
  }
  for (const key of FACET_KEYS) for (const v of filters[key] ?? []) params.append(key, v);
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
  for (const key of FACET_KEYS) {
    const values = params.getAll(key).filter(Boolean);
    if (values.length > 0) filters[key] = values;
  }
  return filters;
}

/** Converte os campos simples antigos em facetas (para o painel novo). */
export function normalizeFilters(filters: QuestionFilters): QuestionFilters {
  const next: QuestionFilters = { ...filters };
  const move = (from: "disciplina" | "tema" | "ano" | "dificuldade" | "banca", to: FacetKey, alls: string[]) => {
    const v = next[from];
    delete next[from];
    if (!v || alls.includes(v)) return;
    next[to] = Array.from(new Set([...(next[to] ?? []), v]));
  };
  move("disciplina", "areas", ["todas"]);
  move("tema", "temas", ["todos"]);
  move("ano", "anos", ["todos"]);
  move("dificuldade", "dificuldades", ["todas"]);
  if (next.banca === "INEP") {
    delete next.banca;
    next.origens = Array.from(new Set([...(next.origens ?? []), "Revalida (INEP)"]));
  }
  if (next.favoritos) {
    delete next.favoritos;
    next.historico = Array.from(new Set([...(next.historico ?? []), "favoritas"]));
  }
  return next;
}

export function hasAnyFilter(filters: QuestionFilters): boolean {
  return Object.entries(filters).some(([k, v]) => k !== "ordem" && k !== "escopo" && (Array.isArray(v) ? v.length > 0 : Boolean(v)));
}

export interface FilterChip {
  key: keyof QuestionFilters | `${string}:${string}`;
  label: string;
}

/** Filtros aplicados como chips removíveis ("Cardiologia ×", "Errei ×"). */
export function describeFilters(
  filters: QuestionFilters,
  subjectName: (slug: string) => string,
  listName: (id: string) => string = (id) => id
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (!isAll(filters.disciplina, "todas")) chips.push({ key: "disciplina", label: subjectName(filters.disciplina!) });
  if (!isAll(filters.tema, "todos")) chips.push({ key: "tema", label: filters.tema! });
  if (!isAll(filters.subtema, "todos")) chips.push({ key: "subtema", label: filters.subtema! });
  if (!isAll(filters.banca, "todas")) chips.push({ key: "banca", label: filters.banca! });
  if (!isAll(filters.ano, "todos")) chips.push({ key: "ano", label: filters.ano! });
  if (!isAll(filters.dificuldade, "todas")) chips.push({ key: "dificuldade", label: `Dificuldade ${filters.dificuldade}` });
  for (const facet of FACETS) {
    for (const v of filters[facet.key] ?? []) {
      let label = v;
      if (facet.key === "areas") label = subjectName(v);
      else if (facet.key === "anos") label = v === "0" ? "Sem ano" : v;
      else if (facet.key === "dificuldades") label = DIFICULDADE_LABELS[v] ?? v;
      else if (facet.key === "caracteristicas") label = CARACTERISTICA_LABELS[v] ?? v;
      else if (facet.key === "historico") label = HISTORICO_LABELS[v] ?? v;
      else if (facet.key === "listas") label = `Lista: ${listName(v)}`;
      chips.push({ key: `${facet.key}:${v}`, label });
    }
  }
  if (filters.status && filters.status !== "todos")
    chips.push({ key: "status", label: STATUS_TABS.find((t) => t.id === filters.status)?.label ?? filters.status });
  for (const tag of filters.tags ?? []) chips.push({ key: `tag:${tag}`, label: `#${tag}` });
  if (filters.favoritos) chips.push({ key: "favoritos", label: "Favoritas" });
  if (filters.excluirAnuladas) chips.push({ key: "excluirAnuladas", label: "Sem anuladas" });
  if (filters.modo === "revisao") chips.push({ key: "modo", label: "Revisão" });
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”${filters.escopo && filters.escopo !== "tudo" ? ` em ${SCOPE_LABELS[filters.escopo].toLowerCase()}` : ""}` });
  return chips;
}

export function removeFilterChip(filters: QuestionFilters, key: FilterChip["key"]): QuestionFilters {
  if (typeof key === "string" && key.includes(":")) {
    const [prefix, ...rest] = key.split(":");
    const value = rest.join(":");
    if (prefix === "tag") return { ...filters, tags: (filters.tags ?? []).filter((t) => t !== value) };
    const facet = prefix as FacetKey;
    const next = { ...filters, [facet]: (filters[facet] ?? []).filter((v) => v !== value) };
    if ((next[facet] ?? []).length === 0) delete next[facet];
    return next;
  }
  const next = { ...filters };
  delete next[key as keyof QuestionFilters];
  if (key === "disciplina") {
    delete next.tema;
    delete next.subtema;
  }
  if (key === "tema") delete next.subtema;
  if (key === "q") delete next.escopo;
  return next;
}
