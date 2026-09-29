// Monta quizzes sem IA, a partir do banco de questões (funciona offline e sem
// chave de API) — e converte as respostas da IA para o formato do quiz.

import { reflowText } from "./reflowText";
import type { QuizDificuldade, QuizQuestion, QuizTipo } from "./quizStore";
import type { Question, QuestionProgress } from "./types";
import { normalizeText, seededHash } from "./utils";

export function buildQuizFromBank(
  questions: Question[],
  opts: {
    quantidade: number;
    subjectSlug?: string;
    busca?: string;
    dificuldade: QuizDificuldade;
    progressMap: Record<string, QuestionProgress>;
    somenteRevalida?: boolean;
  }
): QuizQuestion[] {
  const terms = normalizeText(opts.busca ?? "")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const pool = questions.filter((q) => {
    if (q.anulada || q.hasImage || q.alternatives.length < 2 || !q.gabarito) return false;
    if (opts.subjectSlug && q.subjectSlug !== opts.subjectSlug) return false;
    if (opts.somenteRevalida && q.banca !== "INEP") return false;
    if (terms.length > 0) {
      const text = normalizeText(`${q.tema ?? ""} ${q.especialidade ?? ""} ${q.secao ?? ""} ${q.enunciado}`);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  });

  // Fácil: prioriza temas em que o aluno já acerta; difícil: os que ele erra
  // e as questões do Revalida (enunciados mais longos). Sempre com sorteio.
  const score = (q: Question) => {
    const p = opts.progressMap[q.id];
    const wrong = p?.history.filter((h) => !h.correct).length ?? 0;
    const right = p?.history.filter((h) => h.correct).length ?? 0;
    let s = Math.random();
    if (!p) s += 0.6;
    if (opts.dificuldade === "dificil") s += wrong * 0.8 + (q.banca === "INEP" ? 0.5 : 0) + Math.min(1, q.enunciado.length / 1200);
    if (opts.dificuldade === "facil") s += right * 0.5 - Math.min(1, q.enunciado.length / 1200);
    return s;
  };

  return pool
    .map((q) => ({ q, s: score(q) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, opts.quantidade)
    .map(({ q }) => ({
      id: `qq-${q.id}`,
      tipo: (q.banca === "INEP" ? "enamed" : "multipla") as QuizTipo,
      enunciado: reflowText(q.enunciado),
      tema: q.tema ?? q.especialidade,
      comentario: q.comentario,
      alternatives: q.alternatives.map((a) => ({ ...a, text: reflowText(a.text) })),
      gabarito: q.gabarito,
      sourceQuestionId: q.id,
    }));
}

interface AiQuestion {
  tipo?: QuizTipo;
  enunciado: string;
  alternatives?: { letter: string; text: string }[];
  gabarito?: string;
  afirmacoes?: { texto: string; verdadeira: boolean }[];
  pares?: { esquerda: string; direita: string }[];
  comentario?: string;
  tema?: string;
}

export function fromAiQuestions(items: AiQuestion[]): QuizQuestion[] {
  return items.map((q, i) => ({
    id: `qq-ia-${seededHash(`${q.enunciado}-${i}-${Date.now()}`)}`,
    tipo: q.tipo ?? "multipla",
    enunciado: q.enunciado,
    tema: q.tema || undefined,
    comentario: q.comentario || undefined,
    alternatives: q.alternatives as QuizQuestion["alternatives"],
    gabarito: q.gabarito,
    afirmacoes: q.afirmacoes,
    pares: q.pares,
  }));
}

/** Embaralhamento estável da coluna B da correlação (mesma ordem a cada abertura). */
export function correlacaoOrder(q: QuizQuestion): number[] {
  const n = q.pares?.length ?? 0;
  const idx = Array.from({ length: n }, (_, i) => i);
  let seed = seededHash(q.id) % 233280 || 7;
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  // Evita deixar a coluna B já na ordem certa.
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift()!);
  return idx;
}
