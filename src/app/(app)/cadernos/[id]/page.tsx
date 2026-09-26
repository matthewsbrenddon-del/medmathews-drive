"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookMarked } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EmptyBoxIllustration } from "@/components/Illustrations";
import { QuestionBattery } from "@/components/QuestionBattery";
import { useNotebookStore } from "@/lib/notebookStore";
import { useQuestionStore } from "@/lib/questionStore";

export default function CadernoDetailPage({ params }: { params: { id: string } }) {
  const notebooks = useNotebookStore((s) => s.notebooks);
  const entries = useNotebookStore((s) => s.entries);
  const allQuestions = useQuestionStore((s) => s.questions);

  const notebook = notebooks.find((n) => n.id === params.id);
  if (!notebook) notFound();

  const questionIds = entries[params.id];
  const questions = useMemo(
    () => (questionIds ?? []).map((id) => allQuestions.find((q) => q.id === id)).filter((q): q is NonNullable<typeof q> => Boolean(q)),
    [questionIds, allQuestions]
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/cadernos" className="text-sm font-medium text-primary inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Voltar para Meus Cadernos
        </Link>
        <h1 className="text-2xl font-semibold text-foreground mt-3 inline-flex items-center gap-2.5">
          <BookMarked size={22} className="text-accent" /> {notebook.name}
        </h1>
        <p className="text-muted-foreground mt-1 font-metric">{questions.length} questões</p>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          illustration={<EmptyBoxIllustration />}
          title="Este caderno ainda não tem questões."
          description="Adicione questões a ele pelo ícone de caderno no Banco de Questões ou nos Quizzes."
        />
      ) : (
        <QuestionBattery questions={questions} kind="estudo" />
      )}
    </div>
  );
}
