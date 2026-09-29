"use client";

// ============================================================================
// Cronograma personalizável (v3) — sobre o acervo REAL (biblioteca enriquecida
// com tema/subtema) e o banco de questões.
//
// O aluno escolhe: período (início/fim), minutos por dia da semana, folgas,
// grandes áreas com prioridade e os temas específicos de cada uma, cursos e
// tipos de material, a mistura aulas/questões/revisão, ordem sequencial ou
// intercalada e revisão espaçada (D+1, D+7, D+30).
//
// O plano nunca é persistido: é recalculado a partir do progresso atual, então
// concluir uma aula antes (ou depois) do previsto já reorganiza os próximos dias.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClassifiedFile } from "./classification";
import { addDaysIso, diffInDays, todayIso } from "./dateUtil";
import { fileKind, fileTitle, isFileComplete, naturalCompare } from "./library";
import { needsReview } from "./questionProgressStore";
import type { ContentProgress, Question, QuestionProgress } from "./types";
import { normalizeText } from "./utils";

export type Prioridade = 1 | 2 | 3;

export interface AreaConfig {
  prioridade: Prioridade;
  /** Temas escolhidos nesta grande área (vazio = área fora do cronograma). */
  temas: string[];
}

export interface CronogramaConfig {
  active: boolean;
  inicio: string;
  fim: string;
  /** Minutos de estudo por dia da semana — índice 0 = segunda … 6 = domingo. */
  minutosPorDia: number[];
  folgas: string[];
  areas: Record<string, AreaConfig>;
  /** Cursos usados (vazio = todos). */
  cursos: string[];
  /** Tipos de material incluídos (Videoaula, Resumo, ...). */
  tipos: string[];
  /** Para cada tema, usa só o curso com mais aulas dele (evita ver o mesmo assunto 5 vezes). */
  umCursoPorTema: boolean;
  mix: { aulas: number; questoes: number; revisao: number };
  ordem: "sequencial" | "intercalado";
  revisaoEspacada: boolean;
}

export const TIPOS_MATERIAL = [
  "Videoaula",
  "Pílula",
  "Resumo",
  "Mapa mental",
  "Slide",
  "Apostila",
  "Capítulo de livro",
  "Podcast",
  "Flashcards",
  "Resolução de questão",
  "Caso clínico",
  "Demonstração",
];

const DEFAULT_TIPOS = ["Videoaula", "Resumo", "Mapa mental"];

const MINUTOS_POR_TIPO: Record<string, number> = {
  Videoaula: 35,
  Pílula: 8,
  Podcast: 20,
  Resumo: 20,
  Slide: 15,
  Apostila: 45,
  "Capítulo de livro": 40,
  "Mapa mental": 10,
  "Resolução de questão": 10,
  Flashcards: 15,
  "Caso clínico": 20,
  "Caso da série": 15,
  Demonstração: 15,
};

export const MINUTOS_POR_QUESTAO = 2;
const REVISAO_MINUTOS = 15;

export function defaultConfig(): CronogramaConfig {
  const hoje = todayIso();
  return {
    active: false,
    inicio: hoje,
    fim: addDaysIso(hoje, 60),
    minutosPorDia: [180, 180, 180, 180, 180, 120, 0],
    folgas: [],
    areas: {},
    cursos: [],
    tipos: DEFAULT_TIPOS,
    umCursoPorTema: true,
    mix: { aulas: 55, questoes: 35, revisao: 10 },
    ordem: "intercalado",
    revisaoEspacada: true,
  };
}

interface CronogramaStore {
  config: CronogramaConfig;
  /** Revisões marcadas como feitas (chave do item). */
  feitos: Record<string, true>;
  setConfig: (config: CronogramaConfig) => void;
  deactivate: () => void;
  toggleFeito: (key: string) => void;
}

export const useCronogramaStore = create<CronogramaStore>()(
  persist(
    (set) => ({
      config: defaultConfig(),
      feitos: {},
      setConfig: (config) => set({ config }),
      deactivate: () => set((s) => ({ config: { ...s.config, active: false } })),
      toggleFeito: (key) =>
        set((s) => {
          const next = { ...s.feitos };
          if (next[key]) delete next[key];
          else next[key] = true;
          return { feitos: next };
        }),
    }),
    {
      name: "medstudy-hub-cronograma",
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CronogramaStore>;
        return { ...current, feitos: p.feitos ?? {}, config: { ...defaultConfig(), ...(p.config ?? {}) } };
      },
    }
  )
);

/** 0 = segunda … 6 = domingo. */
export function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
}

export function estimateMinutes(file: ClassifiedFile): number {
  const m = file.conteudo.match(/(\d{1,2})h(\d{1,2})m/);
  if (m) return Math.max(5, Number(m[1]) * 60 + Number(m[2]));
  return MINUTOS_POR_TIPO[file.tipo ?? ""] ?? (fileKind(file) === "video" ? 35 : 20);
}

// ---------------------------------------------------------------------------
// Questões de um tema do acervo (os temas do banco têm outra grafia): casa
// pela palavra mais significativa do tema nos campos de assunto da questão.
// ---------------------------------------------------------------------------

const STOP = new Set([
  "doenca", "doencas", "sindrome", "sindromes", "cancer", "outros", "outras", "geral", "gerais", "tumores", "infeccoes",
  "disturbios", "transtornos", "diagnostico", "tratamento", "clinica", "clinico", "clinicos", "avaliacao", "manejo",
  "introducao", "abordagem", "topicos", "aspectos", "principios", "conceitos", "parte", "medicina",
]);

/** Temas amplos (nome de especialidade, módulo de cursinho): vão para o fim da lista. */
const BROAD = new Set(
  [
    "clinica medica", "cirurgia", "cirurgia geral", "pediatria", "ginecologia", "obstetricia", "ginecologia e obstetricia",
    "preventiva", "medicina preventiva", "preventiva e mfc", "cardiologia", "gastroenterologia", "nefrologia", "infectologia",
    "hematologia", "endocrinologia", "pneumologia", "reumatologia", "neurologia", "psiquiatria", "hepatologia",
    "medicina interna", "urgencia e emergencia", "especiais", "miscelanea",
  ]
);

export function isBroadTema(tema: string): boolean {
  const n = normalizeText(tema).trim();
  return BROAD.has(n) || /^(topicos|introducao|compilado|questoes)\b/.test(n) || /\s\d+$/.test(n);
}

export function temaKeyword(tema: string): string | null {
  const words = normalizeText(tema)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  if (words.length === 0) return null;
  return words.sort((a, b) => b.length - a.length)[0].slice(0, 9);
}

const questionTopicCache = new WeakMap<Question, string>();
function questionTopicText(q: Question): string {
  let t = questionTopicCache.get(q);
  if (t === undefined) {
    t = normalizeText(`${q.tema ?? ""} ${q.subtema ?? ""} ${q.secao ?? ""} ${q.especialidade ?? ""}`);
    questionTopicCache.set(q, t);
  }
  return t;
}

export function questionsForTema(questions: Question[], tema: string): Question[] {
  if (isBroadTema(tema)) return [];
  const key = temaKeyword(tema);
  if (!key) return [];
  return questions.filter((q) => !q.anulada && questionTopicText(q).includes(key));
}

// ---------------------------------------------------------------------------
// Catálogo de temas por grande área (para a tela de configuração).
// ---------------------------------------------------------------------------

export interface TemaInfo {
  tema: string;
  areaSlug: string;
  aulas: number;
  materiais: number;
  minutos: number;
  questoes: number;
  cursos: string[];
  /** Tema amplo (especialidade inteira / módulo) — listado por último. */
  geral: boolean;
}

export function buildTemaCatalog(files: ClassifiedFile[], questions: Question[]): Map<string, TemaInfo[]> {
  const map = new Map<string, Map<string, TemaInfo>>();
  for (const f of files) {
    if (!f.subjectSlug || !f.tema || f.tipo === "Imagem de questão") continue;
    const byTema = map.get(f.subjectSlug) ?? new Map<string, TemaInfo>();
    const info = byTema.get(f.tema) ?? {
      tema: f.tema,
      areaSlug: f.subjectSlug,
      aulas: 0,
      materiais: 0,
      minutos: 0,
      questoes: 0,
      cursos: [],
      geral: isBroadTema(f.tema),
    };
    if (fileKind(f) === "video") info.aulas++;
    else info.materiais++;
    info.minutos += estimateMinutes(f);
    if (!info.cursos.includes(f.curso)) info.cursos.push(f.curso);
    byTema.set(f.tema, info);
    map.set(f.subjectSlug, byTema);
  }
  const out = new Map<string, TemaInfo[]>();
  for (const [slug, byTema] of Array.from(map.entries())) {
    const list = Array.from(byTema.values()).filter((t) => t.aulas + t.materiais >= 2);
    for (const t of list) t.questoes = t.geral ? 0 : questionsForTema(questions, t.tema).length;
    list.sort(
      (a, b) => Number(a.geral) - Number(b.geral) || b.questoes - a.questoes || b.aulas - a.aulas || a.tema.localeCompare(b.tema, "pt-BR")
    );
    out.set(slug, list);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plano
// ---------------------------------------------------------------------------

export type PlanKind = "aula" | "material" | "questoes" | "revisao";

export interface CronoItem {
  key: string;
  kind: PlanKind;
  title: string;
  tema: string;
  areaSlug: string;
  minutes: number;
  file?: ClassifiedFile;
  questionCount?: number;
  /** "D+1", "D+7", "D+30" */
  revisao?: string;
}

export interface CronoDay {
  date: string;
  budget: number;
  used: number;
  items: CronoItem[];
}

export interface CronoPlan {
  days: CronoDay[];
  /** Conteúdo selecionado que não coube no período. */
  sobra: { itens: number; minutos: number };
  totalConteudoMin: number;
  disponivelMin: number;
  temasTotal: number;
  temasConcluidos: number;
  /** Tema -> data prevista de término do conteúdo. */
  terminoPorTema: Map<string, string>;
}

interface TemaUnit {
  tema: string;
  areaSlug: string;
  prioridade: Prioridade;
  files: ClassifiedFile[];
  questoesPendentes: number;
}

function orderUnits(units: TemaUnit[], ordem: CronogramaConfig["ordem"]): TemaUnit[] {
  const byArea = new Map<string, TemaUnit[]>();
  for (const u of units) {
    const list = byArea.get(u.areaSlug) ?? [];
    list.push(u);
    byArea.set(u.areaSlug, list);
  }
  const areas = Array.from(byArea.entries()).sort((a, b) => b[1][0].prioridade - a[1][0].prioridade);
  if (ordem === "sequencial") return areas.flatMap(([, list]) => list);
  // Intercalado ponderado: a cada rodada, área de prioridade p entra com p temas.
  const out: TemaUnit[] = [];
  const cursors = areas.map(([, list]) => ({ list, i: 0, p: list[0]?.prioridade ?? 1 }));
  while (cursors.some((c) => c.i < c.list.length)) {
    for (const c of cursors) {
      for (let k = 0; k < c.p && c.i < c.list.length; k++) out.push(c.list[c.i++]);
    }
  }
  return out;
}

export function buildCronograma(params: {
  config: CronogramaConfig;
  files: ClassifiedFile[];
  userStates: Record<string, ContentProgress>;
  questions: Question[];
  questionProgress: Record<string, QuestionProgress>;
  today?: string;
}): CronoPlan {
  const { config, files, userStates, questions, questionProgress } = params;
  const today = params.today ?? todayIso();
  const tipos = new Set(config.tipos);
  const cursos = new Set(config.cursos);

  // 1) Temas escolhidos -> arquivos pendentes, na ordem de leitura do curso.
  const wanted = new Map<string, string>(); // tema␟area -> area
  for (const [slug, a] of Object.entries(config.areas)) for (const t of a.temas) wanted.set(`${t}␟${slug}`, slug);

  const grouped = new Map<string, ClassifiedFile[]>();
  const allOfTema = new Map<string, ClassifiedFile[]>();
  for (const f of files) {
    if (!f.subjectSlug || !f.tema) continue;
    const key = `${f.tema}␟${f.subjectSlug}`;
    if (!wanted.has(key)) continue;
    if (f.tipo === "Imagem de questão") continue;
    if (!tipos.has(f.tipo ?? (fileKind(f) === "video" ? "Videoaula" : "Apostila"))) continue;
    if (cursos.size > 0 && !cursos.has(f.curso)) continue;
    const list = allOfTema.get(key) ?? [];
    list.push(f);
    allOfTema.set(key, list);
  }

  let temasConcluidos = 0;
  for (const [key, list] of Array.from(allOfTema.entries())) {
    let chosen = list;
    if (config.umCursoPorTema) {
      const score = new Map<string, number>();
      for (const f of list) score.set(f.curso, (score.get(f.curso) ?? 0) + (fileKind(f) === "video" ? 3 : 1));
      const best = Array.from(score.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      chosen = list.filter((f) => f.curso === best);
    }
    chosen.sort((a, b) => naturalCompare(`${a.curso} › ${a.conteudo}`, `${b.curso} › ${b.conteudo}`));
    const pending = chosen.filter((f) => !isFileComplete(f, userStates[f.id]));
    if (pending.length === 0) temasConcluidos++;
    grouped.set(key, pending);
  }

  const pendingQ = (q: Question) => {
    const p = questionProgress[q.id];
    return !p || p.status === "nao_respondida" || needsReview(p);
  };

  const units: TemaUnit[] = [];
  for (const [key, slug] of Array.from(wanted.entries())) {
    const tema = key.split("␟")[0];
    const prioridade = config.areas[slug]?.prioridade ?? 2;
    units.push({
      tema,
      areaSlug: slug,
      prioridade,
      files: grouped.get(key) ?? [],
      questoesPendentes: questionsForTema(questions, tema).filter(pendingQ).length,
    });
  }
  // Dentro de cada área: temas mais cobrados (mais questões) primeiro.
  units.sort((a, b) => b.questoesPendentes - a.questoesPendentes || a.tema.localeCompare(b.tema, "pt-BR"));
  const ordered = orderUnits(units, config.ordem);

  const queue: { file: ClassifiedFile; unit: TemaUnit; last: boolean }[] = [];
  for (const u of ordered) u.files.forEach((file, i) => queue.push({ file, unit: u, last: i === u.files.length - 1 }));
  const totalConteudoMin = queue.reduce((s, q) => s + estimateMinutes(q.file), 0);

  // 2) Dias.
  const start = config.inicio > today ? config.inicio : today;
  const nDays = Math.max(0, Math.min(400, diffInDays(start, config.fim) + 1));
  const folgas = new Set(config.folgas);
  const days: CronoDay[] = [];
  const terminoPorTema = new Map<string, string>();
  const studied: TemaUnit[] = []; // temas cujo conteúdo já foi agendado (mais recente por último)
  const qLeft = new Map<TemaUnit, number>(ordered.map((u) => [u, u.questoesPendentes]));
  // Temas sem conteúdo pendente (já assistidos) entram direto na fila de questões.
  for (const u of ordered) if (u.files.length === 0) studied.push(u);
  let qi = 0;
  let disponivelMin = 0;

  for (let d = 0; d < nDays; d++) {
    const date = addDaysIso(start, d);
    const budget = folgas.has(date) ? 0 : config.minutosPorDia[weekdayIndex(date)] ?? 0;
    const day: CronoDay = { date, budget, used: 0, items: [] };
    days.push(day);
    if (budget <= 0) continue;
    disponivelMin += budget;

    const mixTotal = Math.max(1, config.mix.aulas + config.mix.questoes + config.mix.revisao);
    let aulaBudget = qi < queue.length ? Math.round((budget * config.mix.aulas) / mixTotal) : 0;
    let revBudget = Math.round((budget * config.mix.revisao) / mixTotal);

    // Aulas / materiais
    let usedAula = 0;
    while (qi < queue.length) {
      const next = queue[qi];
      const min = estimateMinutes(next.file);
      if (usedAula > 0 && usedAula + min > aulaBudget) break;
      day.items.push({
        key: `f:${next.file.id}`,
        kind: fileKind(next.file) === "video" ? "aula" : "material",
        title: fileTitle(next.file),
        tema: next.unit.tema,
        areaSlug: next.unit.areaSlug,
        minutes: min,
        file: next.file,
      });
      usedAula += min;
      qi++;
      if (next.last) {
        terminoPorTema.set(next.unit.tema, date);
        studied.push(next.unit);
      }
      if (usedAula >= aulaBudget) break;
    }
    aulaBudget = usedAula;

    // Revisão espaçada
    let usedRev = 0;
    if (config.revisaoEspacada) {
      for (const [label, back] of [["D+1", 1], ["D+7", 7], ["D+30", 30]] as const) {
        const target = addDaysIso(date, -back);
        for (const [tema, fim] of Array.from(terminoPorTema.entries())) {
          if (fim !== target || usedRev + REVISAO_MINUTOS > revBudget) continue;
          const unit = ordered.find((u) => u.tema === tema)!;
          day.items.push({
            key: `r:${tema}:${label}`,
            kind: "revisao",
            title: `Revisão ${label} — ${tema}`,
            tema,
            areaSlug: unit.areaSlug,
            minutes: REVISAO_MINUTOS,
            revisao: label,
          });
          usedRev += REVISAO_MINUTOS;
        }
      }
    }
    revBudget = usedRev;

    // Questões: com o que sobrou do dia, dos temas estudados mais recentemente.
    let questBudget = budget - aulaBudget - revBudget;
    // Primeiro os temas recém-estudados; se não houver questões deles, os próximos da fila.
    const candidates = [...studied].reverse();
    for (const u of ordered) if (!candidates.includes(u)) candidates.push(u);
    for (const unit of candidates) {
      if (questBudget < MINUTOS_POR_QUESTAO * 5) break;
      const left = qLeft.get(unit) ?? 0;
      if (left <= 0) continue;
      const n = Math.min(left, Math.floor(questBudget / MINUTOS_POR_QUESTAO), 40);
      if (n < 5) continue;
      day.items.push({
        key: `q:${unit.tema}:${date}`,
        kind: "questoes",
        title: `${n} questões — ${unit.tema}`,
        tema: unit.tema,
        areaSlug: unit.areaSlug,
        minutes: n * MINUTOS_POR_QUESTAO,
        questionCount: n,
      });
      qLeft.set(unit, left - n);
      questBudget -= n * MINUTOS_POR_QUESTAO;
    }
    day.used = day.items.reduce((s, i) => s + i.minutes, 0);
  }

  const sobraItens = queue.slice(qi);
  return {
    days,
    sobra: { itens: sobraItens.length, minutos: sobraItens.reduce((s, q) => s + estimateMinutes(q.file), 0) },
    totalConteudoMin,
    disponivelMin,
    temasTotal: wanted.size,
    temasConcluidos,
    terminoPorTema,
  };
}

/** Parâmetros de /questoes/estudo para um bloco de questões do tema. */
export function questoesHref(tema: string, count: number): string {
  const key = temaKeyword(tema) ?? tema;
  const p = new URLSearchParams({ q: key, escopo: "tema", limite: String(count), titulo: `Cronograma — ${tema}` });
  p.append("historico", "nunca");
  return `/questoes/estudo?${p.toString()}`;
}
