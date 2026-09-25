"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ClipboardList, Clock, X } from "lucide-react";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useStudyStore } from "@/lib/store";
import { filterQuestions, type QuestionFilters } from "@/lib/questionFilters";
import { resolveSubject } from "@/lib/subjects";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Stage = "setup" | "running" | "results";

function ProvaContent() {
  const searchParams = useSearchParams();
  const questions = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);
  const answerQuestion = useQuestionProgressStore((s) => s.answerQuestion);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);

  const tagsParam = searchParams.get("tags");
  const filters: QuestionFilters = {
    disciplina: searchParams.get("disciplina") ?? undefined,
    tema: searchParams.get("tema") ?? undefined,
    subtema: searchParams.get("subtema") ?? undefined,
    tags: tagsParam ? tagsParam.split(",") : undefined,
    banca: searchParams.get("banca") ?? undefined,
    ano: searchParams.get("ano") ?? undefined,
    dificuldade: searchParams.get("dificuldade") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };

  // Questões anuladas (sem gabarito único) ficam de fora do Modo Prova — não há
  // como pontuá-las com segurança num bloco cronometrado/avaliado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const available = useMemo(() => filterQuestions(questions, filters, progressMap).filter((q) => !q.anulada), [questions]);

  const [stage, setStage] = useState<Stage>("setup");
  const [quantidade, setQuantidade] = useState(Math.min(10, available.length || 1));
  const [minutos, setMinutos] = useState(Math.max(5, Math.round(Math.min(10, available.length || 1) * 1.5)));
  const [exam, setExam] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // O intervalo do timer é criado uma única vez (efeito depende só de `stage`),
  // então precisa ler `answers`/`exam` por ref para não persistir um snapshot
  // vazio quando o tempo se esgota sozinho.
  const answersRef = useRef(answers);
  const examRef = useRef(exam);
  const finishedRef = useRef(false);
  answersRef.current = answers;
  examRef.current = exam;

  useEffect(() => {
    if (stage !== "running") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishExam();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (available.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhuma questão disponível com esses filtros."
        description="Volte para o banco de questões e ajuste os filtros."
        action={
          <Link href="/questoes" className="btn-primary">
            Voltar para Questões
          </Link>
        }
      />
    );
  }

  function handleStart() {
    const set = shuffle(available).slice(0, quantidade);
    finishedRef.current = false;
    setExam(set);
    setAnswers({});
    setCurrent(0);
    setSecondsLeft(minutos * 60);
    setStage("running");
  }

  function finishExam() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const finalAnswers = answersRef.current;
    const finalExam = examRef.current;
    for (const [questionId, selected] of Object.entries(finalAnswers)) {
      const q = finalExam.find((e) => e.id === questionId);
      if (q) answerQuestion(questionId, selected, q.gabarito);
    }
    if (Object.keys(finalAnswers).length > 0) recordStudyToday();
    setStage("results");
    setConfirmFinish(false);
  }

  if (stage === "setup") {
    return (
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        <div className="text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent mx-auto">
            <ClipboardList size={26} />
          </div>
          <h1 className="text-xl font-semibold text-foreground mt-4">Montar Modo Prova</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {available.length} questões disponíveis com os filtros selecionados.
          </p>
        </div>

        <div className="card p-6 flex flex-col gap-5">
          <div>
            <label htmlFor="quantidade" className="text-sm font-medium text-foreground block mb-1.5">
              Quantidade de questões
            </label>
            <input
              id="quantidade"
              type="number"
              min={1}
              max={available.length}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.min(available.length, Math.max(1, Number(e.target.value))))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="minutos" className="text-sm font-medium text-foreground block mb-1.5">
              Tempo (minutos)
            </label>
            <input
              id="minutos"
              type="number"
              min={1}
              value={minutos}
              onChange={(e) => setMinutos(Math.max(1, Number(e.target.value)))}
              className="input"
            />
          </div>
          <button type="button" className="btn-primary" onClick={handleStart}>
            Iniciar prova
          </button>
        </div>
      </div>
    );
  }

  if (stage === "running") {
    const question = exam[current];
    const subject = resolveSubject(question.subjectName);
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Questão {current + 1} de {exam.length} · {answeredCount} respondidas
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium font-metric",
              secondsLeft < 60 ? "bg-danger/10 text-danger" : "bg-muted text-foreground"
            )}
          >
            <Clock size={14} /> {formatClock(secondsLeft)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {exam.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrent(idx)}
              className={cn(
                "h-8 w-8 rounded-lg text-xs font-medium font-metric border transition-colors",
                idx === current
                  ? "border-primary bg-primary text-primary-foreground"
                  : answers[q.id]
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border text-muted-foreground hover:bg-surface-hover"
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <div className="card p-6">
          <p className="text-xs font-medium" style={{ color: `hsl(${subject.colorToken})` }}>
            {subject.name}
          </p>
          <p className="text-foreground leading-relaxed mt-2">{question.enunciado}</p>

          <div className="flex flex-col gap-2 mt-5">
            {question.alternatives.map((alt) => (
              <button
                key={alt.letter}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, [question.id]: alt.letter }))}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  answers[question.id] === alt.letter ? "border-primary bg-primary-light" : "border-border hover:bg-surface-hover"
                )}
              >
                <span className="font-semibold shrink-0">{alt.letter})</span>
                <span className="flex-1">{alt.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn-outline"
            disabled={current === 0}
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            Anterior
          </button>
          {current < exam.length - 1 ? (
            <button type="button" className="btn-primary" onClick={() => setCurrent((c) => c + 1)}>
              Próxima
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setConfirmFinish(true)}>
              Finalizar prova
            </button>
          )}
        </div>

        <ConfirmationModal
          open={confirmFinish}
          title="Finalizar a prova?"
          description={
            answeredCount < exam.length
              ? `Você respondeu ${answeredCount} de ${exam.length} questões. As demais ficarão em branco.`
              : "Você respondeu todas as questões."
          }
          confirmLabel="Finalizar"
          onConfirm={finishExam}
          onCancel={() => setConfirmFinish(false)}
        />
      </div>
    );
  }

  // results
  const correctCount = exam.filter((q) => answers[q.id] === q.gabarito).length;
  const score = Math.round((correctCount / exam.length) * 100);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div className="text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary mx-auto">
          <ClipboardList size={26} />
        </div>
        <h1 className="text-xl font-semibold text-foreground mt-4">Resultado da prova</h1>
        <p className="text-muted-foreground mt-1">
          Você acertou <strong>{correctCount}</strong> de <strong>{exam.length}</strong> questões ({score}%).
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {exam.map((question, idx) => {
          const selected = answers[question.id];
          const correct = selected === question.gabarito;
          return (
            <div key={question.id} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs font-medium text-muted-foreground">Questão {idx + 1}</p>
                {selected ? (
                  correct ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <Check size={13} /> Acertou
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                      <X size={13} /> Errou
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <AlertTriangle size={13} /> Em branco
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground">{question.enunciado}</p>
              <div className="flex flex-col gap-1.5 mt-3">
                {question.alternatives.map((alt) => {
                  const isCorrect = alt.letter === question.gabarito;
                  const isSelected = alt.letter === selected;
                  return (
                    <div
                      key={alt.letter}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs",
                        isCorrect
                          ? "border-success bg-success/10"
                          : isSelected
                            ? "border-danger bg-danger/10"
                            : "border-border"
                      )}
                    >
                      <strong>{alt.letter})</strong> {alt.text}
                    </div>
                  );
                })}
              </div>
              {question.comentario && (
                <p className="text-xs text-muted-foreground mt-3 bg-muted rounded-lg p-3">{question.comentario}</p>
              )}
            </div>
          );
        })}
      </div>

      <Link href="/questoes" className="btn-primary self-center">
        Voltar para Questões
      </Link>
    </div>
  );
}

export default function ProvaPage() {
  return (
    <Suspense fallback={<LoadingState label="Preparando a prova..." />}>
      <ProvaContent />
    </Suspense>
  );
}
