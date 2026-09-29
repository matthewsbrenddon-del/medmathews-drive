"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Brain, Check, Clock, RotateCcw, Save, Trophy } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { QuizQuestionView, isAnswered } from "@/components/quiz/QuizQuestionView";
import { QUIZ_PALETTE, attemptSummary, useQuizStore, type QuizAnswer } from "@/lib/quizStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useQuestionStore } from "@/lib/questionStore";
import { useStudyStore } from "@/lib/store";
import { KNOWN_SUBJECTS } from "@/lib/subjects";
import type { Question, QuestionAlternative } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ResponderQuizPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const quiz = useQuizStore((s) => s.quizzes.find((q) => q.id === params.id));
  const startAttempt = useQuizStore((s) => s.startAttempt);
  const saveAnswer = useQuizStore((s) => s.answer);
  const finishAttempt = useQuizStore((s) => s.finishAttempt);
  const answerBankQuestion = useQuestionProgressStore((s) => s.answerQuestion);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);
  const importQuestions = useQuestionStore((s) => s.importQuestions);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<QuizAnswer | undefined>(undefined);
  const [finished, setFinished] = useState(false);
  const [savedToBank, setSavedToBank] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startedRef = useRef(false);

  // Retoma uma tentativa em andamento ou começa uma nova.
  useEffect(() => {
    if (!quiz || startedRef.current) return;
    startedRef.current = true;
    const open = [...quiz.attempts].reverse().find((a) => !a.finishedAt);
    if (open) {
      setAttemptId(open.id);
      const firstPending = quiz.questions.findIndex((q) => open.answers[q.id] === undefined);
      setIndex(firstPending === -1 ? quiz.questions.length - 1 : firstPending);
    } else setAttemptId(startAttempt(quiz.id));
  }, [quiz, startAttempt]);

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [finished]);

  const attempt = quiz?.attempts.find((a) => a.id === attemptId);
  const question = quiz?.questions[index];
  const committed = question && attempt ? attempt.answers[question.id] : undefined;
  const revealed = committed !== undefined;

  useEffect(() => {
    setDraft(undefined);
  }, [index]);

  const summary = useMemo(() => (quiz && attempt ? attemptSummary(quiz, attempt) : null), [quiz, attempt]);

  if (!quiz) {
    return (
      <EmptyState
        illustration={<Brain size={36} className="text-muted-foreground" />}
        title="Quiz não encontrado."
        action={
          <Link href="/quizzes" className="btn-primary">
            Voltar para Quizzes
          </Link>
        }
      />
    );
  }
  if (!attempt || !question || !summary) return null;

  const palette = QUIZ_PALETTE[quiz.cor % QUIZ_PALETTE.length];
  const total = quiz.questions.length;
  const answeredCount = Object.keys(attempt.answers).length;
  const current = revealed ? committed : draft;

  function confirm() {
    if (!quiz || !attempt || !question || !isAnswered(question, draft)) return;
    saveAnswer(quiz.id, attempt.id, question.id, draft!);
    recordStudyToday();
    // Questões vindas do banco também contam no seu histórico de questões.
    if (question.sourceQuestionId && typeof draft === "string" && question.gabarito) {
      answerBankQuestion(question.sourceQuestionId, draft, question.gabarito);
    }
  }

  function next() {
    if (index < total - 1) setIndex(index + 1);
    else {
      finishAttempt(quiz!.id, attempt!.id);
      setFinished(true);
    }
  }

  function saveToBank() {
    if (!quiz) return;
    const subject = KNOWN_SUBJECTS.find((s) => s.slug === quiz.subjectSlug) ?? KNOWN_SUBJECTS[0];
    const mc = quiz.questions.filter((q) => q.alternatives && q.gabarito && !q.sourceQuestionId);
    const questions: Question[] = mc.map((q) => ({
      id: `quiz-${q.id}`,
      subjectSlug: subject.slug,
      subjectName: subject.name,
      tema: q.tema,
      banca: "Gerado por IA",
      enunciado: q.enunciado,
      alternatives: q.alternatives as QuestionAlternative[],
      gabarito: q.gabarito!,
      comentario: q.comentario,
      dificuldade: quiz.dificuldade === "facil" ? 2 : quiz.dificuldade === "dificil" ? 4 : 3,
      tags: ["Quiz IA"],
      origem: "ia",
    }));
    importQuestions(questions, {
      fileName: `Quiz — ${quiz.titulo}`,
      importedAt: new Date().toISOString(),
      totalRows: questions.length,
      imported: questions.length,
      skipped: 0,
    });
    setSavedToBank(questions.length);
  }

  if (finished) {
    const pct = summary.percent;
    const circumference = 2 * Math.PI * 52;
    const iaMc = quiz.questions.filter((q) => q.alternatives && q.gabarito && !q.sourceQuestionId).length;
    return (
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
        <div className={cn("rounded-3xl p-8 ring-4 flex flex-col sm:flex-row items-center gap-8", palette.bg, palette.ring)}>
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-black/5 dark:stroke-white/10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                stroke="currentColor"
                className={cn("transition-all duration-700", pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger")}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-metric text-foreground">{pct}%</span>
              <span className="text-xs text-muted-foreground">aproveitamento</span>
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className={cn("text-sm font-semibold inline-flex items-center gap-1.5", palette.text)}>
              <Trophy size={15} /> Quiz concluído em {fmt(seconds)}
            </p>
            <h1 className="text-2xl font-semibold text-foreground mt-1">{quiz.titulo}</h1>
            <p className="text-muted-foreground mt-2">
              <strong className="text-success font-metric">{summary.certas}</strong> de <span className="font-metric">{total}</span> totalmente certas
              {summary.points - summary.certas > 0.01 && <> · pontuação com parciais: <span className="font-metric">{summary.points.toFixed(1)}</span></>}
            </p>
            <div className="flex flex-wrap gap-2 mt-5 justify-center sm:justify-start">
              <Link href={`/quizzes/${quiz.id}`} className="btn-primary">
                <Check size={15} /> Revisar respostas
              </Link>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  startedRef.current = true;
                  setAttemptId(startAttempt(quiz.id));
                  setIndex(0);
                  setSeconds(0);
                  setFinished(false);
                }}
              >
                <RotateCcw size={15} /> Responder novamente
              </button>
              {iaMc > 0 && (
                <button type="button" className="btn-ghost" onClick={saveToBank} disabled={savedToBank !== null}>
                  <Save size={15} /> {savedToBank !== null ? `${savedToBank} salvas no banco ✓` : `Salvar ${iaMc} no banco de questões`}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {quiz.questions.map((q, i) => {
            const sc = attempt.scores[q.id] ?? 0;
            return (
              <div key={q.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                <span
                  className={cn(
                    "h-7 w-7 shrink-0 rounded-full inline-flex items-center justify-center text-xs font-bold",
                    sc >= 0.999 ? "bg-success/15 text-success" : sc > 0 ? "bg-warning/15 text-warning" : "bg-danger/15 text-danger"
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">{q.enunciado}</span>
                <span className="font-metric text-xs text-muted-foreground">{Math.round(sc * 100)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-5 pb-10">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push(`/quizzes/${quiz.id}`)} className="btn-ghost btn-sm" aria-label="Sair do quiz">
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{quiz.titulo}</p>
          <div className="mt-1.5 flex gap-1">
            {quiz.questions.map((q, i) => {
              const sc = attempt.scores[q.id];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para a questão ${i + 1}`}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    sc === undefined ? (i === index ? "bg-primary/60" : "bg-muted") : sc >= 0.999 ? "bg-success" : sc > 0 ? "bg-warning" : "bg-danger"
                  )}
                />
              );
            })}
          </div>
        </div>
        <span className="font-metric text-xs text-muted-foreground inline-flex items-center gap-1">
          <Clock size={13} /> {fmt(seconds)}
        </span>
        <span className="font-metric text-sm text-foreground">
          {index + 1}/{total}
        </span>
      </div>

      <div className="card p-6 sm:p-8">
        <QuizQuestionView question={question} answer={current} onAnswer={revealed ? undefined : setDraft} revealed={revealed} number={index + 1} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" className="btn-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          <ArrowLeft size={15} /> Anterior
        </button>
        <span className="text-xs text-muted-foreground font-metric">{answeredCount} de {total} respondidas</span>
        {revealed ? (
          <button type="button" className="btn-primary" onClick={next}>
            {index < total - 1 ? (
              <>
                Próxima <ArrowRight size={15} />
              </>
            ) : (
              <>
                Ver resultado <Trophy size={15} />
              </>
            )}
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={!isAnswered(question, draft)} onClick={confirm}>
            <Check size={15} /> Confirmar resposta
          </button>
        )}
      </div>
    </div>
  );
}
