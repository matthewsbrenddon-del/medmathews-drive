"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brain, Check, ChevronRight, Star, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { useStudyStore } from "@/lib/store";
import { filterQuestions, type QuestionFilters } from "@/lib/questionFilters";
import { resolveSubject } from "@/lib/subjects";
import { cn } from "@/lib/utils";

function EstudoContent() {
  const searchParams = useSearchParams();
  const questions = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);
  const answerQuestion = useQuestionProgressStore((s) => s.answerQuestion);
  const toggleFavorite = useQuestionProgressStore((s) => s.toggleFavorite);
  const recordStudyToday = useStudyStore((s) => s.recordStudyToday);

  const filters: QuestionFilters = {
    disciplina: searchParams.get("disciplina") ?? undefined,
    banca: searchParams.get("banca") ?? undefined,
    ano: searchParams.get("ano") ?? undefined,
    dificuldade: searchParams.get("dificuldade") ?? undefined,
    modo: searchParams.get("modo") === "revisao" ? "revisao" : undefined,
  };
  const startId = searchParams.get("start");

  const queue = useMemo(() => {
    const list = filterQuestions(questions, filters, progressMap);
    if (startId) {
      const idx = list.findIndex((q) => q.id === startId);
      if (idx > 0) {
        const [item] = list.splice(idx, 1);
        list.unshift(item);
      }
    }
    return list;
    // A fila é montada uma vez e não deve encolher conforme o usuário responde
    // (senão o índice atual "pula" questões) — por isso não depende de progressMap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState({ correct: 0, answered: 0 });

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="Nenhuma questão para estudar com esses filtros."
        description="Volte para o banco de questões e ajuste os filtros."
        action={
          <Link href="/questoes" className="btn-primary">
            Voltar para Questões
          </Link>
        }
      />
    );
  }

  if (index >= queue.length) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
          <Check size={26} />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Sessão concluída!</h1>
        <p className="text-muted-foreground">
          Você acertou <strong>{session.correct}</strong> de <strong>{session.answered}</strong> questões.
        </p>
        <div className="flex gap-2">
          <Link href="/questoes" className="btn-primary">
            Voltar para Questões
          </Link>
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setSession({ correct: 0, answered: 0 });
            }}
            className="btn-outline"
          >
            Refazer
          </button>
        </div>
      </div>
    );
  }

  const question = queue[index];
  const subject = resolveSubject(question.subjectName);
  const progress = progressMap[question.id];
  const favorite = progress?.favorite ?? false;

  function handleSubmit() {
    if (!selected) return;
    const correct = answerQuestion(question.id, selected, question.gabarito);
    setSubmitted(true);
    setSession((s) => ({ correct: s.correct + (correct ? 1 : 0), answered: s.answered + 1 }));
    recordStudyToday();
  }

  function handleNext() {
    setIndex((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Questão {index + 1} de {queue.length}
        </p>
        <p className="text-sm font-medium font-metric text-foreground">
          {session.correct}/{session.answered} acertos nesta sessão
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: `hsl(${subject.colorToken})` }}>
              {subject.name}
            </span>
            {question.banca && <span className="text-xs text-muted-foreground">· {question.banca}</span>}
            {question.ano && <span className="text-xs text-muted-foreground">· {question.ano}</span>}
            <PriorityBadge priority={question.dificuldade} />
          </div>
          <button type="button" onClick={() => toggleFavorite(question.id)} aria-label="Favoritar questão">
            <Star size={17} className={favorite ? "fill-warning text-warning" : "text-muted-foreground"} />
          </button>
        </div>

        <p className="text-foreground leading-relaxed">{question.enunciado}</p>
        {question.hasImage && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            Esta questão faz referência a uma imagem (ver planilha original).
          </p>
        )}

        <div className="flex flex-col gap-2 mt-5">
          {question.alternatives.map((alt) => {
            const isSelected = selected === alt.letter;
            const isCorrect = alt.letter === question.gabarito;
            let style = "border-border hover:bg-surface-hover";
            if (submitted) {
              if (isCorrect) style = "border-success bg-success/10";
              else if (isSelected) style = "border-danger bg-danger/10";
            } else if (isSelected) {
              style = "border-primary bg-primary-light";
            }
            return (
              <button
                key={alt.letter}
                type="button"
                disabled={submitted}
                onClick={() => setSelected(alt.letter)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default",
                  style
                )}
              >
                <span className="font-semibold shrink-0">{alt.letter})</span>
                <span className="flex-1">{alt.text}</span>
                {submitted && isCorrect && <Check size={16} className="text-success shrink-0" />}
                {submitted && isSelected && !isCorrect && <X size={16} className="text-danger shrink-0" />}
              </button>
            );
          })}
        </div>

        {submitted && question.comentario && (
          <div className="mt-5 rounded-xl bg-muted p-4">
            <p className="text-xs font-medium text-foreground mb-1">Comentário</p>
            <p className="text-sm text-muted-foreground">{question.comentario}</p>
          </div>
        )}

        <div className="mt-6">
          {!submitted ? (
            <button type="button" disabled={!selected} className="btn-primary" onClick={handleSubmit}>
              Confirmar resposta
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleNext}>
              Próxima questão <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EstudoPage() {
  return (
    <Suspense fallback={<LoadingState label="Preparando sessão de estudo..." />}>
      <EstudoContent />
    </Suspense>
  );
}
