"use client";

import { ImageIcon, Star } from "lucide-react";
import { useQuestionProgressStore } from "@/lib/questionProgressStore";
import { reflowText } from "@/lib/reflowText";
import { resolveSubject } from "@/lib/subjects";
import type { Question } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

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
      className="card relative overflow-hidden p-4 pl-5 flex flex-col gap-2.5 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 w-full cursor-pointer"
    >
      <span aria-hidden className="absolute left-0 inset-y-0 w-1" style={{ background: `hsl(${subject.colorToken})` }} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-xs font-semibold" style={{ color: `hsl(${subject.colorToken})` }}>
            {subject.name}
          </span>
          {question.especialidade && question.especialidade !== subject.name && (
            <span className="text-xs text-muted-foreground truncate">· {question.especialidade}</span>
          )}
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

      {question.tema && <p className="text-[11px] font-medium text-foreground/80 line-clamp-1 -mt-1">{question.tema}</p>}

      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{reflowText(question.enunciado)}</p>

      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
              question.banca ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {question.banca ? `${question.banca === "INEP" ? "Revalida" : question.banca}${question.ano ? ` ${question.ano}` : ""}` : question.origem === "ia" ? "IA" : "Coletânea"}
          </span>
          {question.hasImage && <ImageIcon size={13} className="text-muted-foreground shrink-0" aria-label="Tem imagem" />}
          {question.dificuldade > 0 && <PriorityBadge priority={question.dificuldade} />}
        </div>
        {question.anulada ? (
          <span className="rounded-full bg-warning/10 text-warning text-xs font-medium px-2 py-0.5">Anulada</span>
        ) : (
          <StatusBadge status={progress.status} kind="question" />
        )}
      </div>
    </div>
  );
}
