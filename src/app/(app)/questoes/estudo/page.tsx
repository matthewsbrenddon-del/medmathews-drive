"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, Zap } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EmptySearchIllustration } from "@/components/Illustrations";
import { LoadingState } from "@/components/LoadingState";
import { QuestionBattery } from "@/components/QuestionBattery";
import { useQuestionStore, useQuestionsReady } from "@/lib/questionStore";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { describeFilters, filterQuestions, paramsToFilters, seededShuffle, sortQuestions } from "@/lib/questionFilters";
import { useNotebookStore } from "@/lib/notebookStore";
import { resolveSubject } from "@/lib/subjects";

function EstudoContent() {
  const searchParams = useSearchParams();
  const questions = useQuestionStore((s) => s.questions);
  const progressMap = useQuestionProgressStore((s) => s.progress);
  const ready = useQuestionsReady();

  const filters = paramsToFilters(new URLSearchParams(searchParams.toString()));
  const startId = searchParams.get("start");
  const limite = Number(searchParams.get("limite")) || 0;
  const seed = Number(searchParams.get("seed")) || 0;
  const titulo = searchParams.get("titulo");

  const listKey = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("start");
    return p.toString() || "todas";
  }, [searchParams]);

  const queue = useMemo(() => {
    let list = sortQuestions(filterQuestions(questions, filters, progressMap), filters.ordem, progressMap);
    if (seed) list = seededShuffle(list, seed);
    if (limite > 0) list = list.slice(0, limite);
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
  }, [questions, listKey]);

  const notebooks = useNotebookStore((s) => s.notebooks);
  const chips = describeFilters(
    filters,
    (slug) => resolveSubject(slug).name,
    (id) => notebooks.find((n) => n.id === id)?.name ?? "lista"
  );

  if (!ready) return <LoadingState label="Carregando o banco de questões..." />;

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
      <div className="max-w-3xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
            {seed ? <Zap size={17} className="text-warning" /> : null}
            {titulo || (seed ? "Simulado relâmpago" : "Resolver questões")}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground font-metric">{queue.length} questões</span>
            {chips.map((c) => (
              <span key={String(c.key)} className="rounded-full bg-muted text-muted-foreground text-[11px] px-2 py-0.5">
                {c.label}
              </span>
            ))}
          </div>
        </div>
        <Link href={`/questoes?${searchParams.toString()}`} className="btn-outline btn-sm">
          <SlidersHorizontal size={13} /> Ajustar filtros
        </Link>
      </div>
      <QuestionBattery
        questions={queue}
        kind="estudo"
        listKey={listKey}
        exportTitle={titulo?.replace(/^⚡\s*/, "") || "Apostila de Questões"}
        exportSubtitle={chips.length > 0 ? chips.map((c) => c.label).join(" · ") : "Seleção do banco de questões"}
      />
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
