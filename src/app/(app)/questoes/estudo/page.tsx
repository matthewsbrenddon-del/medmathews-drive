"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brain } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EmptySearchIllustration } from "@/components/Illustrations";
import { LoadingState } from "@/components/LoadingState";
import { QuestionBattery } from "@/components/QuestionBattery";
import { useQuestionStore } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { filterQuestions, type QuestionFilters } from "@/lib/questionFilters";

function EstudoContent() {
  const searchParams = useSearchParams();
  const questions = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);

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
    // (senão os cartões "somem" da tela) — por isso não depende de progressMap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  if (queue.length === 0) {
    return (
      <EmptyState
        illustration={<EmptySearchIllustration />}
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

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-metric">{queue.length} questões nesta bateria</p>
        <Link href="/questoes" className="text-sm font-medium text-primary inline-flex items-center gap-1">
          <Brain size={14} /> Ajustar filtros
        </Link>
      </div>
      <QuestionBattery questions={queue} kind="estudo" />
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
