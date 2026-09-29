"use client";

// ============================================================================
// Quizzes — coleções curtas e interativas de questões (geradas por IA ou
// montadas do banco), com pastas, tentativas e correção automática.
//
// Tipos de questão:
// - multipla / vinheta / enamed: alternativas A–E, uma correta.
// - vf: afirmações para marcar Verdadeiro/Falso (cada item vale um acerto parcial).
// - correlacao: associar itens da coluna A aos da coluna B.
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestionAlternative } from "./types";
import { seededHash } from "./utils";

export type QuizTipo = "multipla" | "vinheta" | "vf" | "correlacao" | "enamed";
export type QuizDificuldade = "facil" | "medio" | "dificil";

export const QUIZ_TIPOS: { id: QuizTipo; label: string; descricao: string }[] = [
  { id: "multipla", label: "Múltipla escolha", descricao: "4–5 alternativas e uma resposta correta." },
  { id: "vinheta", label: "Vinheta clínica", descricao: "Caso clínico seguido de pergunta diagnóstica ou de conduta." },
  { id: "vf", label: "Verdadeiro ou falso", descricao: "Julgue cada afirmação como verdadeira ou falsa." },
  { id: "correlacao", label: "Correlação", descricao: "Associe os itens de duas colunas." },
  { id: "enamed", label: "Estilo ENAMED", descricao: "Enunciados longos e interpretativos, 4 alternativas." },
];

export const DIFICULDADE_LABEL: Record<QuizDificuldade, string> = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };

export interface QuizQuestion {
  id: string;
  tipo: QuizTipo;
  enunciado: string;
  tema?: string;
  comentario?: string;
  /** multipla / vinheta / enamed */
  alternatives?: QuestionAlternative[];
  gabarito?: string;
  /** vf */
  afirmacoes?: { texto: string; verdadeira: boolean }[];
  /** correlacao: `direita` já na ordem correta; a tela embaralha. */
  pares?: { esquerda: string; direita: string }[];
  /** Quando veio do banco de questões. */
  sourceQuestionId?: string;
}

/** Resposta do aluno: letra (múltipla), lista de V/F, ou índice escolhido por item (correlação). */
export type QuizAnswer = string | boolean[] | number[];

export interface QuizAttempt {
  id: string;
  startedAt: string;
  finishedAt?: string;
  answers: Record<string, QuizAnswer>;
  /** Pontuação 0–1 por questão (V/F e correlação podem ser parciais). */
  scores: Record<string, number>;
}

export interface Quiz {
  id: string;
  titulo: string;
  folderId?: string;
  /** Índice na paleta de cores dos cards. */
  cor: number;
  createdAt: string;
  fonte: "ia" | "banco";
  tipos: QuizTipo[];
  dificuldade: QuizDificuldade;
  subjectSlug?: string;
  contexto?: string;
  questions: QuizQuestion[];
  attempts: QuizAttempt[];
}

export interface QuizFolder {
  id: string;
  nome: string;
}

export function scoreQuestion(q: QuizQuestion, answer: QuizAnswer | undefined): number {
  if (answer === undefined) return 0;
  if (q.tipo === "vf") {
    const items = q.afirmacoes ?? [];
    const given = answer as boolean[];
    if (items.length === 0) return 0;
    return items.filter((a, i) => given[i] === a.verdadeira).length / items.length;
  }
  if (q.tipo === "correlacao") {
    const pares = q.pares ?? [];
    const given = answer as number[];
    if (pares.length === 0) return 0;
    return pares.filter((_, i) => given[i] === i).length / pares.length;
  }
  return answer === q.gabarito ? 1 : 0;
}

export function attemptSummary(quiz: Quiz, attempt: QuizAttempt) {
  const total = quiz.questions.length;
  const points = quiz.questions.reduce((sum, q) => sum + (attempt.scores[q.id] ?? 0), 0);
  const certas = quiz.questions.filter((q) => (attempt.scores[q.id] ?? 0) >= 0.999).length;
  return { total, points, certas, percent: total > 0 ? Math.round((points / total) * 100) : 0 };
}

export function lastFinishedAttempt(quiz: Quiz): QuizAttempt | undefined {
  return [...quiz.attempts].reverse().find((a) => a.finishedAt);
}

interface QuizStoreState {
  quizzes: Quiz[];
  folders: QuizFolder[];
  createQuiz: (quiz: Omit<Quiz, "id" | "createdAt" | "attempts" | "cor"> & { cor?: number }) => Quiz;
  deleteQuiz: (id: string) => void;
  renameQuiz: (id: string, titulo: string) => void;
  moveQuiz: (id: string, folderId?: string) => void;
  createFolder: (nome: string) => QuizFolder;
  deleteFolder: (id: string) => void;
  startAttempt: (quizId: string) => string;
  answer: (quizId: string, attemptId: string, questionId: string, value: QuizAnswer) => void;
  finishAttempt: (quizId: string, attemptId: string) => void;
}

const newId = (prefix: string) => `${prefix}-${seededHash(`${Date.now()}-${Math.random()}`)}`;

export const useQuizStore = create<QuizStoreState>()(
  persist(
    (set, get) => ({
      quizzes: [],
      folders: [],

      createQuiz: (input) => {
        const quiz: Quiz = {
          ...input,
          id: newId("quiz"),
          createdAt: new Date().toISOString(),
          attempts: [],
          cor: input.cor ?? get().quizzes.length % 6,
        };
        set((s) => ({ quizzes: [quiz, ...s.quizzes] }));
        return quiz;
      },
      deleteQuiz: (id) => set((s) => ({ quizzes: s.quizzes.filter((q) => q.id !== id) })),
      renameQuiz: (id, titulo) => set((s) => ({ quizzes: s.quizzes.map((q) => (q.id === id ? { ...q, titulo } : q)) })),
      moveQuiz: (id, folderId) => set((s) => ({ quizzes: s.quizzes.map((q) => (q.id === id ? { ...q, folderId } : q)) })),
      createFolder: (nome) => {
        const folder = { id: newId("pasta"), nome: nome.trim() || "Nova pasta" };
        set((s) => ({ folders: [...s.folders, folder] }));
        return folder;
      },
      deleteFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          quizzes: s.quizzes.map((q) => (q.folderId === id ? { ...q, folderId: undefined } : q)),
        })),

      startAttempt: (quizId) => {
        const attempt: QuizAttempt = { id: newId("tentativa"), startedAt: new Date().toISOString(), answers: {}, scores: {} };
        set((s) => ({ quizzes: s.quizzes.map((q) => (q.id === quizId ? { ...q, attempts: [...q.attempts, attempt] } : q)) }));
        return attempt.id;
      },
      answer: (quizId, attemptId, questionId, value) =>
        set((s) => ({
          quizzes: s.quizzes.map((quiz) => {
            if (quiz.id !== quizId) return quiz;
            const question = quiz.questions.find((q) => q.id === questionId);
            if (!question) return quiz;
            return {
              ...quiz,
              attempts: quiz.attempts.map((a) =>
                a.id === attemptId
                  ? {
                      ...a,
                      answers: { ...a.answers, [questionId]: value },
                      scores: { ...a.scores, [questionId]: scoreQuestion(question, value) },
                    }
                  : a
              ),
            };
          }),
        })),
      finishAttempt: (quizId, attemptId) =>
        set((s) => ({
          quizzes: s.quizzes.map((quiz) =>
            quiz.id !== quizId
              ? quiz
              : { ...quiz, attempts: quiz.attempts.map((a) => (a.id === attemptId ? { ...a, finishedAt: new Date().toISOString() } : a)) }
          ),
        })),
    }),
    { name: "medstudy-hub-quizzes", version: 1 }
  )
);

/** Paleta pastel dos cards (borda / fundo / texto), clara e escura. */
export const QUIZ_PALETTE = [
  { ring: "ring-violet-300/70 dark:ring-violet-500/40", bg: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { ring: "ring-lime-300/80 dark:ring-lime-500/40", bg: "bg-lime-50 dark:bg-lime-500/10", text: "text-lime-700 dark:text-lime-300", dot: "bg-lime-500" },
  { ring: "ring-pink-300/70 dark:ring-pink-500/40", bg: "bg-pink-50 dark:bg-pink-500/10", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
  { ring: "ring-sky-300/70 dark:ring-sky-500/40", bg: "bg-sky-50 dark:bg-sky-500/10", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  { ring: "ring-amber-300/80 dark:ring-amber-500/40", bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { ring: "ring-emerald-300/70 dark:ring-emerald-500/40", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
];
