"use client";

import { Star } from "lucide-react";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { resolveSubject } from "@/lib/subjects";
import type { Question } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

export function QuestionCard({ question, onClick }: { question: Question; onClick?: () => void }) {
  const progress = useQuestionProgressStore((s) => s.getProgress(question.id));
  const toggleFavorite = useQuestionProgressStore((s) => s.toggleFavorite);
  const subject = resolveSubject(question.subjectName);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="card p-4 flex flex-col gap-3 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 w-full cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: `hsl(${subject.colorToken})` }}>
            {subject.name}
          </span>
          {question.banca && <span className="text-xs text-muted-foreground">· {question.banca}</span>}
          {question.ano && <span className="text-xs text-muted-foreground">· {question.ano}</span>}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(question.id);
          }}
          aria-label={progress.favorite ? "Remover dos favoritos" : "Favoritar"}
          className="shrink-0"
        >
          <Star size={15} className={progress.favorite ? "fill-warning text-warning" : "text-muted-foreground"} />
        </button>
      </div>

      <p className="text-sm text-foreground line-clamp-3">{question.enunciado}</p>

      <div className="flex items-center justify-between mt-auto pt-1">
        <PriorityBadge priority={question.dificuldade} />
        <StatusBadge status={progress.status} kind="question" />
      </div>
    </div>
  );
}
